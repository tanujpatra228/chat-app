# Chat App — Features

> Last updated: 2026-05-28

## Phase 1 — Core

### User Authentication
- **Register** with email, unique username (3-50 chars, alphanumeric + underscore), and password (8+ chars)
- **Login** with email + password
- Email is **private** — never exposed in search results, profiles, or API responses. Users share their **username** to connect with others.
- Single JWT token (7 days expiry) stored in localStorage, sent as `Authorization: Bearer <token>`
- Logout is client-side — delete token from localStorage
- Protected routes redirect to login

### Conversations
- Start a new conversation by searching for a user by username
- `POST /api/conversations` creates a new conversation or returns existing one if the pair already has one (deduplication)
- Conversation list shows the other participant's name, last message preview, and timestamp
- Unread message count badge per conversation

### Messaging
- Send text messages in a conversation
- Messages display with sent/received styling (right-aligned for sent, left-aligned for received)
- Timestamp on each message
- Soft delete (sender only) — content replaced with "Message deleted"

---

## Phase 2 — Real-time + UX

### Real-time Delivery (Socket.IO)
- Persistent bidirectional WebSocket connection via Socket.IO
- JWT authenticated via `socket.handshake.auth.token`
- Each conversation ID is a Socket.IO room — user joins all their conversation rooms on connect
- Built-in reconnection with exponential backoff
- Heartbeat managed automatically by Socket.IO
- Auto-reconnect on tab visibility restore, `window.online`, and `window.focus`

### Optimistic Updates
- Messages appear instantly with a `sending` status and temporary client ID
- `socket.emit('send_message', data, ackCallback)` — uses Socket.IO ack for delivery confirmation
- On ack: replace temp message with real server message (ID, timestamp)
- On failure: show `failed` status with retry and delete buttons
- Failed messages persisted in localStorage — survive page refresh, retryable on next load

### Typing Indicators
- Keystroke triggers `socket.emit('typing_start', { conversationId })` (debounced 300ms)
- `socket.emit('typing_stop', { conversationId })` after 3s of inactivity
- Recipient receives `user_typing` / `user_stopped_typing` events
- No DB storage, no REST calls

### Read Receipts
- Viewing a conversation emits `socket.emit('mark_read', { conversationId, messageId })`
- Backend updates `conversation_participants.last_read_message_id`
- Broadcasts `messages_read` to conversation room
- Double-check mark on messages read by the other user

### Reply-to Threading
- Reply to any non-pending message
- Desktop: hover to reveal reply button
- Mobile: long-press (500ms) to trigger reply
- Reply preview above the message input (sender name + truncated content)
- Clicking a reply reference scrolls to and highlights the original message
- `reply_to_id` FK uses `ON DELETE SET NULL` — reply context preserved even if original message expires

### Cursor-Based Pagination
- Messages loaded in pages of 20, ordered by `created_at DESC`
- Scroll near top triggers load more; viewport position preserved during prepend
- Cursor = oldest loaded message's `created_at`

### Message List Scroll
- Plain scrollable div — scroll-position math handles initial jump-to-bottom, prepend restore, and new-message auto-scroll
- `shouldScrollRef` tracks whether user is within 120px of bottom — new messages only auto-scroll if near bottom

### Mobile Responsive Layout
- **Desktop (≥768px)**: side-by-side — conversation list sidebar (320px) + message thread
- **Mobile (<768px)**: one panel at a time — conversation list by default, tapping opens thread with back button

### Draft Persistence
- Draft text per conversation stored in localStorage (`drafts:{conversationId}`)
- Saved on conversation switch, restored on return
- Cleared on message send

### User Presence
- Online/offline status tracked via Socket.IO connections
- Green dot on online users in conversation list
- "Last seen X ago" for offline users
- `user_online` / `user_offline` events broadcast on socket connect/disconnect

### Message Editing
- Sender can edit any non-deleted, non-image, non-nudge message
- Desktop: hover to reveal edit pencil icon
- Mobile: long-press action menu includes edit option
- Emits `edit_message` socket event with ack; broadcasts `message_edited` to room
- Edited messages show "edited" label beside timestamp
- `is_edited` flag stored in DB (`updated_at` also updated)

### Image Messages
- Send images via `POST /api/conversations/:id/images` (multipart upload, max 10 MB)
- Accepted types: PNG, JPEG, GIF, WebP, HEIC/HEIF
- Upload progress bar shown inline in message list during upload
- Stored externally (Cloudinary); `image_url` + `image_public_id` on message row
- Tap image to open full-screen lightbox
- `message_type: "image"` — not editable, not linkified

### Nudges
- Double-tap anywhere in the message thread sends a nudge
- Two nudge types: **point** (👉) and **heart** (♥️) — toggled via header button
- Nudge type configurable via `VITE_DEFAULT_NUDGE_TYPE` env var (`"heart"` or `"point"`)
- Rendered as large animated emoji (CSS `animate-nudge` / `animate-heartbeat`), mirrored for sender
- `message_type: "nudge"`, `nudge_type: "point" | "heart"` stored in DB

---

## Phase 3 — Advanced

### Vanishing Messages
- Conversation-level toggle: off, 5 min, 1 hour, 24 hours, 7 days
- New messages in vanishing conversations get `expires_at = NOW() + duration`
- Background job deletes expired messages periodically; broadcasts `messages_expired` to room so clients remove them live
- Ghost icon on vanishing messages, amber indicator in header
- `reply_to_id` FK is `ON DELETE SET NULL` — replies to expired messages keep their text; the quoted preview just clears

### Link Previews
- When a text message contains a URL, backend scrapes Open Graph metadata after the message is saved (fire-and-forget, 5s timeout)
- Uses `open-graph-scraper`; extracts title, description, and image
- Preview stored in `messages` columns: `link_url`, `link_title`, `link_description`, `link_image`
- Server pushes `message_updated` socket event to the conversation room with preview data
- Frontend renders `LinkPreview` card below the message bubble; updates in-place via `updateMessageLinkPreview` in chatStore
- URLs in message text also rendered as inline pill chips via `linkify.tsx` (hostname + truncated path, `ExternalLink` icon)

### Meeting Link Button
- Per-conversation saved URL (e.g. Google Meet link) stored in `conversations.saved_link`
- `PATCH /api/conversations/:id/saved-link` — sets or clears the URL
- Button shown in `ChatHeader`: green when a link is saved, muted when none
- Single tap → opens URL in new tab; long-press (500ms, with vibration) → edit modal
- Edit modal allows setting or removing the saved link

### Conversation Search
- Full-text search across message content: `GET /api/conversations/search/messages?q=`
- PostgreSQL `tsvector` + GIN index
- Results highlight matching text
- Search bar accessible from conversation list

### Encryption at Rest (AES-256-GCM) — Planned
- Server-side encryption of message content before database storage
- Per-message random IV, GCM auth tag for tamper detection
- Master key from environment variable
- Transparent decrypt on read in the repository layer

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register (email, username, password) → returns JWT |
| POST | `/api/auth/login` | Login (email, password) → returns JWT |

### Users
| Method | Path | Description |
|---|---|---|
| GET | `/api/users/me` | Current user profile |
| GET | `/api/users/search?q=` | Search by username (email never exposed) |
| GET | `/api/users/:id` | Get user profile (username, displayName, avatar — no email) |

### Conversations
| Method | Path | Description |
|---|---|---|
| GET | `/api/conversations` | List conversations (with last message + unread) |
| POST | `/api/conversations` | Create or get existing conversation |
| GET | `/api/conversations/:id` | Get conversation details |
| PUT | `/api/conversations/:id/vanishing` | Set vanishing mode and duration |
| PATCH | `/api/conversations/:id/saved-link` | Set or clear saved meeting link |

### Messages (REST)
| Method | Path | Description |
|---|---|---|
| GET | `/api/conversations/:id/messages` | Get message history (cursor pagination) |
| POST | `/api/conversations/:id/images` | Upload and send an image message (multipart, max 10 MB) |
| GET | `/api/conversations/search/messages?q=` | Full-text search across all conversations |

### Socket.IO Events

**Client → Server:**
| Event | Payload | Description |
|---|---|---|
| `send_message` | `{ conversationId, content, replyToId?, nudgeType? }` | Send a message (server acks with saved message) |
| `edit_message` | `{ messageId, conversationId, content }` | Edit own message (server acks; broadcasts to room) |
| `delete_message` | `{ messageId, conversationId }` | Soft delete (sender only) |
| `typing_start` | `{ conversationId }` | User started typing |
| `typing_stop` | `{ conversationId }` | User stopped typing |
| `mark_read` | `{ conversationId, messageId }` | Mark messages read up to messageId |

**Server → Client:**
| Event | Payload | Description |
|---|---|---|
| `new_message` | `{ conversationId, message }` | New message in a conversation |
| `message_deleted` | `{ conversationId, messageId }` | Message was soft-deleted |
| `message_edited` | `{ conversationId, messageId, content }` | Message content was edited |
| `message_updated` | `{ conversationId, messageId, linkUrl, linkTitle, linkDescription, linkImage }` | Link preview data available |
| `messages_expired` | `{ conversationId, ids }` | Vanishing messages physically deleted |
| `user_typing` | `{ conversationId, userId, username }` | Other user is typing |
| `user_stopped_typing` | `{ conversationId, userId }` | Other user stopped typing |
| `messages_read` | `{ conversationId, userId, lastReadMessageId }` | Other user read messages |
| `user_online` | `{ userId }` | User came online |
| `user_offline` | `{ userId, lastSeen }` | User went offline |
| `vanishing_mode_changed` | `{ conversationId, vanishingMode, durationHours, changedByUserId }` | Vanishing mode updated |

---

## Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vanishing_mode BOOLEAN DEFAULT false,
  vanishing_duration_hours INTEGER,
  saved_link TEXT,                          -- meeting link (per-conversation)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_message_id UUID,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  message_type VARCHAR(10) DEFAULT 'text',  -- 'text' | 'image' | 'nudge'
  nudge_type VARCHAR(10),                   -- 'point' | 'heart'
  image_url TEXT,
  image_public_id TEXT,
  link_url TEXT,                            -- first URL in message content
  link_title TEXT,
  link_description TEXT,
  link_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL;
-- Full-text search
CREATE INDEX idx_messages_fts ON messages USING GIN (to_tsvector('english', content));
```
