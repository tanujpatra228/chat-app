# Chat Background Image — Implementation Plan

## Current state

`chat-hearts-bg` is applied to the scroll container (`div` inside `MessageThread`). It's a pure CSS `background-image` — an inline SVG data URL tiling a 240×240px heart pattern at 10–13% opacity. The outer `MessageThread` div has `bg-background/55 backdrop-blur-sm`.

```
MessageThread outer   bg-background/55 backdrop-blur-sm
  ChatHeader          h-14 border-b (no explicit bg — inherits outer)
  scroll container    chat-hearts-bg (SVG hearts repeat, transparent)
  MessageInput
```

## Target layer stack (bottom → top)

```
1. blurred user image     absolute inset-0, object-cover, filter blur-2xl, scale-110
2. tint overlay           absolute inset-0, bg-background/40 (keeps readability)
3. ChatHeader             static z-10, needs bg-background/70 backdrop-blur-sm
4. hearts scroll div      chat-hearts-bg stays unchanged — transparent hearts overlay image
5. MessageInput           static z-10, needs bg or backdrop
```

`scale-110` on the image prevents the Gaussian blur from showing transparent edges.

When no background image is set, behaviour is identical to today.

---

## Implementation steps

### 1. DB migration — `008_conversation_background.sql`

```sql
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS background_image_url TEXT,
  ADD COLUMN IF NOT EXISTS background_image_public_id TEXT;
```

### 2. Backend

**New route** `POST /api/conversations/:id/background`
- Multer in-memory, images only, 10 MB limit (reuse existing upload config)
- Verify participant via `conversationService.verifyParticipant`
- Upload to Cloudinary folder `chat-app/conversation-backgrounds/` with `public_id = conversationId`
  - Use `overwrite: true` so re-upload replaces previous
  - Store `secure_url` + `public_id` on conversation row
- Return `{ background_image_url, background_image_public_id }`

**New route** `DELETE /api/conversations/:id/background`
- Verify participant
- Delete from Cloudinary by `public_id`
- Null out both columns
- Return `{ background_image_url: null }`

**`conversation.repository.js`** — add `updateBackground(id, url, publicId)` and `clearBackground(id)`

**`conversation.routes.js`** — wire both routes

### 3. Types — `frontend/src/lib/types.ts`

Add to `Conversation`:
```ts
background_image_url: string | null
background_image_public_id: string | null
```

### 4. chatStore — `frontend/src/stores/chatStore.ts`

Add action:
```ts
updateConversationBackground: (conversationId: string, url: string | null) => void
```

### 5. Cloudinary low-res URL helper — `frontend/src/utils/cloudinary.ts`

```ts
export function bgThumbnailUrl(url: string): string {
  // Insert Cloudinary transformation before /upload/
  // q_40,w_600,f_auto — small file, CSS handles blur
  return url.replace('/upload/', '/upload/q_40,w_600,f_auto/')
}
```

### 6. MessageThread — layer restructure

Replace outer div structure:

```tsx
<div className="relative flex h-full min-h-0 flex-col">
  {/* Blurred background image */}
  {conversation.background_image_url && (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src={bgThumbnailUrl(conversation.background_image_url)}
          className="h-full w-full scale-110 object-cover blur-2xl"
          aria-hidden
          draggable={false}
        />
      </div>
      {/* Tint to preserve readability */}
      <div className="pointer-events-none absolute inset-0 bg-background/40" />
    </>
  )}

  {/* Fallback — today's look when no image */}
  {!conversation.background_image_url && (
    <div className="pointer-events-none absolute inset-0 bg-background/55 backdrop-blur-sm" />
  )}

  {/* Content — static children sit above absolute layers automatically */}
  <ChatHeader
    conversation={conversation}
    onBack={onBack}
    typingUsers={typingUsers}
    nudgeType={nudgeType}
    onNudgeToggle={toggleNudgeType}
    hasBackground={!!conversation.background_image_url}
  />

  <div
    ref={scrollContainerRef}
    className="chat-hearts-bg relative z-10 min-h-0 flex-1 overflow-y-auto py-2"
    onClick={handleDoubleTap}
  >
    {/* ... messages ... */}
  </div>

  <MessageInput ... />
</div>
```

### 7. ChatHeader — conditional background

Add `hasBackground?: boolean` prop. When true, apply semi-transparent bg so header text stays readable over image:

```tsx
<div
  className={`flex h-14 shrink-0 items-center gap-2 border-b px-2 pt-[env(safe-area-inset-top)] md:px-4 ${
    hasBackground ? "bg-background/70 backdrop-blur-md" : ""
  }`}
>
```

Also add background upload/remove button to header (see §8).

### 8. Upload UI — `ChatBackgroundButton` component

Small button in `ChatHeader` (alongside `MeetLinkButton`):
- Icon: `ImageUp` (lucide)
- Click → hidden `<input type="file" accept="image/*">` trigger
- On file select → `POST /api/conversations/:id/background` with `FormData`
- Show upload spinner while pending
- On success → `updateConversationBackground(conversationId, url)` in chatStore
- Long-press (500ms) OR right-click → "Remove background" → `DELETE /api/conversations/:id/background` → clear chatStore

No modal needed — same long-press pattern as `MeetLinkButton`.

---

## What does NOT change

- `chat-hearts-bg` CSS — untouched, already works as transparent overlay
- Bubble styles, message rendering, scroll logic — untouched
- Dark mode — tint layer `bg-background/40` uses the theme variable, so dark mode adapts automatically

---

## Open questions

1. **Per-user or per-conversation?** Plan above is per-conversation (both users see same bg). If per-user is preferred, store in `conversation_participants` instead and fetch per join.
2. **Blur amount** — `blur-2xl` (40px). Adjust to taste; low-res image + heavy blur = small download.
3. **Tint opacity** — `bg-background/40` starting point. May need separate light/dark values (Tailwind CSS variable handles this automatically via `--background`).
