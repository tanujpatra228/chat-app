# Video & Audio Message Support — Implementation Plan

> Date: 2026-06-01

## Current state

Images are sent via `POST /api/conversations/:id/images` → `message.service.sendImageMessage`
→ Cloudinary (`resource_type: "image"`) → `message_type: "image"` row in DB.
`MessageBubble` renders `<img>` + lightbox for that type.

---

## Design decisions

### Unified media endpoint

Single `POST /api/conversations/:id/media` replaces `/images`.
Server detects `resource_type` from the file's mimetype.
Old `/images` route kept as a deprecated alias (backwards compat for existing clients).

### Cloudinary resource types

| File type | Cloudinary resource_type |
|---|---|
| image/* | `"image"` |
| video/* | `"video"` |
| audio/* | `"video"` (Cloudinary handles audio under the video resource type) |

### DB: reuse existing columns, add two new ones

`image_url` / `image_public_id` stay as-is (they store any media URL — renaming them
would require data migration and is cosmetic). Add:

```sql
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_resource_type VARCHAR(10) DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS media_duration_seconds INTEGER;
```

`media_resource_type` is needed so Cloudinary deletes (which require resource_type)
work correctly. Without it, deleting a video public_id with `resource_type: "image"`
silently does nothing.

### File size limits (multer)

| Type | Limit |
|---|---|
| image | 10 MB (existing) |
| audio | 25 MB |
| video | 100 MB |

**Memory storage concern:** multer `memoryStorage` buffers the entire file in RAM.
100 MB video × concurrent uploads = real memory pressure. For now, accept 50 MB
video cap with memory storage. Larger video support needs disk storage +
Cloudinary streaming — future work.

### message_type values

Add `"video"` and `"audio"` to the existing `"text" | "image" | "nudge"` union.

---

## Files to change

| File | Change |
|---|---|
| `backend/src/migrations/009_media_columns.sql` | New migration |
| `backend/src/services/upload.service.js` | Add `uploadMedia`, update deletes |
| `backend/src/repositories/message.repository.js` | Add media fields to createMessage + expired query |
| `backend/src/services/message.service.js` | Add `sendMediaMessage`, keep `sendImageMessage` as alias |
| `backend/src/routes/conversation.routes.js` | Add `POST /:id/media`, keep `/images` as alias |
| `backend/src/jobs/cleanupExpiredMessages.js` | Pass resource_type to delete calls |
| `frontend/src/lib/types.ts` | Extend Message type |
| `frontend/src/components/chat/MessageInput.tsx` | Accept video/audio, update upload handler |
| `frontend/src/components/chat/MessageBubble.tsx` | Render video/audio branches |
| `frontend/src/utils/cloudinary.ts` | Add `videoThumbnailUrl` helper |

---

## Step-by-step implementation

### 1. Migration — `009_media_columns.sql`

```sql
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_resource_type VARCHAR(10) DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS media_duration_seconds INTEGER;

-- Backfill existing image messages
UPDATE messages SET media_resource_type = 'image' WHERE message_type = 'image';
```

### 2. `upload.service.js` — unified uploadMedia

```js
async function uploadMedia(fileBuffer, conversationId, resourceType = 'image') {
  // resourceType: 'image' | 'video'  (Cloudinary 'video' covers audio too)
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `chat-app/${conversationId}`,
        resource_type: resourceType,
        transformation: [{ quality: "auto" }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          duration: result.duration ?? null,  // seconds, set by Cloudinary for video/audio
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
}

// Update deleteImage to accept resourceType
async function deleteMedia(publicId, resourceType = 'image') {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error(`Failed to delete Cloudinary ${resourceType} ${publicId}:`, err.message);
  }
}

// deleteMultipleImages needs resource_type per item — update signature:
async function deleteMultipleMedia(items) {
  // items: [{ publicId, resourceType }]
  // Group by resourceType (Cloudinary delete_resources is per resource_type)
  const byType = {};
  for (const { publicId, resourceType = 'image' } of items) {
    (byType[resourceType] ??= []).push(publicId);
  }
  for (const [resourceType, publicIds] of Object.entries(byType)) {
    try {
      await cloudinary.api.delete_resources(publicIds, { resource_type: resourceType });
    } catch (err) {
      console.error(`Cloudinary bulk delete (${resourceType}) failed:`, err.message);
    }
  }
}
```

Keep `uploadImage`, `deleteImage`, `deleteMultipleImages` as thin wrappers for backwards compat.

### 3. `message.repository.js`

- Add `mediaResourceType` and `mediaDurationSeconds` params to `createMessage`
- Update `getExpiredImagePublicIds` → `getExpiredMediaItems`:

```js
async function getExpiredMediaItems(batchSize) {
  const { rows } = await pool.query(
    `SELECT image_public_id, media_resource_type
     FROM messages
     WHERE expires_at IS NOT NULL AND expires_at < NOW()
       AND image_public_id IS NOT NULL
     LIMIT $1`,
    [batchSize]
  );
  return rows.map(r => ({ publicId: r.image_public_id, resourceType: r.media_resource_type || 'image' }));
}
```

### 4. `message.service.js`

Helper that resolves `message_type` and `resource_type` from mimetype:

```js
function resolveMediaType(mimetype) {
  if (mimetype.startsWith('video/')) return { messageType: 'video', resourceType: 'video' };
  if (mimetype.startsWith('audio/')) return { messageType: 'audio', resourceType: 'video' };
  return { messageType: 'image', resourceType: 'image' };
}
```

Add `sendMediaMessage({ conversationId, senderId, fileBuffer, mimetype })`.
Keep `sendImageMessage` calling `sendMediaMessage` internally.

### 5. `conversation.routes.js`

New multer config for media (larger limits):

```js
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') ||
                    file.mimetype.startsWith('video/') ||
                    file.mimetype.startsWith('audio/');
    allowed ? cb(null, true) : cb(new ApiError(400, 'Only image, video, and audio files are allowed'));
  },
});

router.post('/:id/media', requireParticipant, mediaUpload.single('file'), async (req, res, next) => { ... });
// Keep existing /images route pointing to same handler for backwards compat
```

### 6. `cleanupExpiredMessages.js`

```js
// Phase 1: delete expired media from Cloudinary
const items = await messageRepo.getExpiredMediaItems(BATCH_SIZE);
await uploadService.deleteMultipleMedia(items);
```

### 7. Frontend: `types.ts`

```ts
message_type?: "text" | "image" | "video" | "audio" | "nudge"
media_duration_seconds?: number | null
media_resource_type?: string | null
```

### 8. Frontend: `MessageInput.tsx`

- Change `accept` from images-only to:
  `image/*,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/ogg,audio/wav`
- Change button icon from `ImagePlus` to `Paperclip`
- Change upload field name from `"image"` to `"file"`
- Change endpoint from `/images` to `/media`
- Add client-side size guard (50 MB)

### 9. Frontend: `MessageBubble.tsx`

Add render branches after the existing image branch:

```tsx
{message.message_type === 'video' && message.image_url && (
  <video
    src={message.image_url}
    controls
    className="max-h-64 w-auto rounded-xl"
    poster={videoThumbnailUrl(message.image_url)}
    preload="metadata"
  />
)}

{message.message_type === 'audio' && message.image_url && (
  <audio
    src={message.image_url}
    controls
    className="w-full max-w-xs"
    preload="metadata"
  />
)}
```

### 10. Frontend: `cloudinary.ts`

```ts
// Generate a video thumbnail from a Cloudinary video URL
export function videoThumbnailUrl(url: string): string {
  return url.replace('/upload/', '/upload/so_auto,f_jpg,w_400,q_60/')
}
```

---

## What this does NOT cover (future work)

- **Disk storage / streaming for large videos** — memory buffer caps at 50 MB
- **Video compression / transcoding settings** — Cloudinary `eager` transformations
- **Waveform visualization for audio** — needs `wavesurfer.js` or similar
- **Video thumbnail in conversation list** (last message preview)
- **Resumable / chunked uploads** — needed for files > 100 MB

---

## Migration order (run before deploying)

```
009_media_columns.sql
```

---

## API changes summary

| Endpoint | Status | Notes |
|---|---|---|
| `POST /:id/images` | kept (alias) | still works, forwards to media handler |
| `POST /:id/media` | new | accepts image, video, audio — field name: `file` |
