# Message List Architecture

> Last updated: 2026-05-27

How messages are fetched, rendered, sent, and kept in sync across the conversation UI.

---

## Overview

Four layers work together:

```
useSocket          — global socket event bus → writes to chatStore
useMessages        — fetch history, send, retry, failed-message persistence
MessageThread      — scroll container, load-more, read receipts, edit/reply orchestration
MessageBubble      — per-message render (text/image/nudge, link preview, actions, status)
```

`chatStore` is the shared state hub. `useSocket` writes to it; `useMessages` and `MessageThread` read from it.

---

## useSocket

**Location:** `frontend/src/hooks/useSocket.ts`

Single `useEffect` mounted once at the app level (not per-conversation). Registers all socket event handlers and cleans them up on unmount.

### Events handled

| Socket event | chatStore action |
|---|---|
| `new_message` | `addMessage`, `updateConversationLastMessage`, `clearTypingUser`, `incrementUnread` (if not active conv) |
| `message_deleted` | `deleteMessage` |
| `message_edited` | `editMessage` |
| `message_updated` | `updateMessageLinkPreview` (link preview arrives async after send) |
| `messages_read` | `markMessagesRead` |
| `messages_expired` | `removeMessages` (vanishing message cleanup) |
| `user_typing` | `setTypingUser` |
| `user_stopped_typing` | `clearTypingUser` |
| `user_online` / `user_offline` | `updateUserOnlineStatus` |
| `vanishing_mode_changed` | `updateVanishingMode` |

### Active conversation tracking

Uses a `ref` (`activeConversationIdRef`) kept in sync with `activeConversationId` from the store. This avoids stale closures inside event handlers — the handler always reads the latest value without re-registering.

### Reconnection

Three triggers re-establish the connection when it drops:
- `socket.io "reconnect"` event → calls `bumpReconnectNonce()` in chatStore
- `visibilitychange` (tab becomes visible) → `socket.connect()` if disconnected
- `window "online"` / `window "focus"` → same

`reconnectNonce` change causes `useMessages` to re-fetch history (via the `useEffect` dependency), ensuring no messages are missed during a gap.

---

## useMessages

**Location:** `frontend/src/hooks/useMessages.ts`

Scoped to a single `conversationId`. Handles REST fetch, cursor pagination, optimistic send, and failed-message persistence.

### Fetch flow

```
fetchMessages()
  → GET /conversations/:id/messages
  → reverse (API returns DESC, store needs ASC)
  → applyReadStatus()   — marks messages readByOther based on other_last_read_message_id
  → attach stableKey = message.id
  → setMessages() into chatStore
```

Re-runs when `conversationId` changes or `reconnectNonce` bumps.

### Cursor pagination (load more)

```
loadMore()
  → GET /conversations/:id/messages?cursor=<oldest_created_at>
  → reverse + applyReadStatus
  → prependMessages() into chatStore
```

Cursor is stored in a `ref` (not state) to avoid triggering re-renders. `hasMore` is tracked in local state.

### applyReadStatus

Marks each message `readByOther: true` if the sender is the current user and the message index is ≤ the index of `other_last_read_message_id`. Edge case: if the read marker ID is not found in the loaded window (marker is older than loaded history), all loaded sent messages are marked read.

### Optimistic send

1. Generate `tempId = "temp-<timestamp>-<random>"`
2. Build `optimisticMessage` with `status: "sending"`, `stableKey: tempId`
3. `addMessage()` → message appears immediately
4. `socket.emit("send_message", ..., ackCallback)`
5. On ack success → `replaceMessage(tempId, serverMessage)` — preserves `stableKey` so the list item doesn't unmount/remount
6. On ack failure → `markMessageFailed(tempId)` + persist to localStorage

Nudge messages use emoji content (`♥️` / `👉`) and `message_type: "nudge"`.

### Failed message persistence

Key: `"failed-messages"` in localStorage. Format: `Record<conversationId, FailedEntry[]>`.

On conversation load, `useEffect` reads persisted failed entries and re-adds them to the store as `status: "failed"` messages — so unsent messages survive page refresh.

`retryMessage(tempId)` → sets status back to `"sending"` → re-emits via socket.
`removeFailedMessage(tempId)` → removes from localStorage and from store.

---

## MessageThread

**Location:** `frontend/src/components/chat/MessageThread.tsx`

Owns the scroll container and coordinates all per-conversation UI concerns.

### Scroll management

Uses a plain `div` with `overflow-y-auto` (not a virtual list). Four refs track scroll state:

| Ref | Purpose |
|---|---|
| `shouldScrollRef` | `true` when user is within 120px of bottom — new messages auto-scroll |
| `didInitialScrollRef` | Prevents double-scroll on initial load |
| `prevFirstIdRef` | First message ID from previous render — detects prepend |
| `savedScrollHeightRef` | `scrollHeight` saved just before `loadMore()` fires |

**`useLayoutEffect` (runs after every `messages` change, before paint):**

- Initial load: `scrollTop = scrollHeight` (jump to bottom, no animation)
- Prepend detected (`prevFirstId !== currentFirstId && length grew`): `scrollTop += (newScrollHeight - savedScrollHeight)` — keeps viewport at same message
- Append (new message, user near bottom): `scrollTop = scrollHeight`

**Scroll event listener:**
- Updates `shouldScrollRef` based on distance from bottom
- Triggers `loadMore()` when `scrollTop < 200px` — saves `scrollHeight` first so `useLayoutEffect` can restore position

### Read receipts

After messages load or change, finds the last message from the other user (non-temp) and emits `mark_read`. Runs in `useEffect` on `messages` change.

### Double-tap nudge

`onClick` on the scroll container (bubbled clicks). 300ms window between taps triggers `sendMessage("", undefined, undefined, undefined, nudgeType)`. Skips if click target is a button/input/link/textarea. Nudge type toggled via `ChatHeader` button.

### Edit flow

`editingMessage` state drives `MessageInput` into `mode="edit"`. On save, emits `socket.emit("edit_message", ..., ack)` then calls `editMessage()` in store on success.

### Reply-to scroll

`handleScrollToMessage(messageId)` → `document.getElementById("msg-<id>")` → `scrollIntoView({ block: "center" })` + 1.5s highlight via `bg-accent/50` class add/remove.

### Upload progress

`uploadProgress` state (0–100 | null) passed to `MessageInput`. When non-null, an inline progress bubble renders at the bottom of the message list.

---

## MessageBubble

**Location:** `frontend/src/components/chat/MessageBubble.tsx`

Renders one message. Pure render — no store access, no side effects.

### Render branches (in order)

1. **Nudge** (`message_type === "nudge"`) — large emoji with CSS animation (`animate-nudge` / `animate-heartbeat`, mirrored for sender)
2. **Deleted** (`is_deleted`) — italic "Message deleted" text, no actions
3. **Image** (`message_type === "image"`) — lazy-loaded `<img>`, click → `ImageLightbox`
4. **Text** — bubble div with `linkifyText()` inline, optional `<LinkPreview>` below

### linkifyText

Splits content by URL regex. URLs render as pill chips (`<a>` with `ExternalLink` icon + truncated hostname). Color adapts to `isMine` (white/transparent vs dark/transparent).

### Link preview

Shown when `message.link_url` is set. Data arrives async via `message_updated` socket event after backend scrapes OG tags. Component: `LinkPreview.tsx` — renders title, description, image, domain.

### Actions

**Desktop (hover):** action buttons appear via `group-hover:flex`. Own messages: edit + reply on the left. Other's messages: reply on the right.

**Mobile (long-press 500ms):** `handleTouchStart` sets a timer; on fire, vibrates (if available) and shows `showActions` popover with reply / edit / copy buttons. `onTouchMove` cancels the timer (scroll protection).

### Status indicators

Shown bottom-right of own messages only:

| State | Icon |
|---|---|
| `sending` | `Clock` |
| `sent`, not read | `Check` (single) |
| `readByOther: true` | `CheckCheck` (blue) |
| `failed` | `ring-destructive` border + Retry / Delete links |

`is_edited` flag renders "edited" label before the timestamp.

---

## Data flow summary

```
User types + sends
  → sendMessage() [useMessages]
    → addMessage (optimistic, status: "sending") → chatStore
    → socket.emit("send_message")
      → ack success → replaceMessage (tempId → real id) → chatStore
      → ack fail   → markMessageFailed + localStorage persist

Socket receives new_message [useSocket]
  → addMessage → chatStore
  → updateConversationLastMessage → chatStore

Socket receives message_updated (link preview) [useSocket]
  → updateMessageLinkPreview → chatStore

chatStore.messages changes
  → MessageThread useLayoutEffect fires
    → scroll position adjusted
  → MessageBubble re-renders with new data
```

---

## Key design choices

**No TanStack Virtual.** Despite being in the feature docs, the current implementation uses a plain scrollable div. Variable-height bubbles made virtualizer height measurement brittle; plain DOM + scroll-position math is simpler and sufficient for typical conversation lengths.

**`stableKey` on messages.** Optimistic messages use `tempId` as `stableKey`. On `replaceMessage`, the `stableKey` is preserved from the original temp entry. This means React's `key` on the list item stays constant across the optimistic→confirmed transition — no unmount/remount, no layout jump.

**`reconnectNonce` pattern.** Instead of `useMessages` subscribing to socket reconnect events directly (which would require lifting socket state or adding another hook dependency), `useSocket` bumps a counter in the store. `useMessages` depends on it via `useEffect([..., reconnectNonce])`, triggering a re-fetch automatically.

**Failed messages in localStorage.** `status: "failed"` messages survive page refresh. On conversation open, `useMessages` restores them from localStorage so the user can retry without losing the unsent content.
