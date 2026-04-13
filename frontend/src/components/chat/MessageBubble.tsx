import { useRef, useCallback, useState } from "react"
import { formatMessageTime } from "@/utils/formatDate"
import type { Message } from "@/lib/types"
import { AlertCircle, Clock, Check, CheckCheck, Reply, Pencil } from "lucide-react"
import { ImageLightbox } from "./ImageLightbox"
import { getSocket } from "@/lib/socket"
import { useChatStore } from "@/stores/chatStore"

interface MessageBubbleProps {
  message: Message
  isMine: boolean
  onReply?: (message: Message) => void
  onScrollToMessage?: (messageId: string) => void
}

const NUDGE_EMOJI = "\u{1F449}"
const LONG_PRESS_MS = 500

export function MessageBubble({
  message,
  isMine,
  onReply,
  onScrollToMessage,
}: MessageBubbleProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const didLongPress = useRef(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const editMessage = useChatStore((s) => s.editMessage)

  const canReply = !!onReply && !message.tempId && !message.is_deleted
  const canEdit =
    isMine &&
    !message.is_edited &&
    !message.is_deleted &&
    !message.tempId &&
    message.message_type !== "image" &&
    message.content !== NUDGE_EMOJI

  function startEditing() {
    setEditContent(message.content)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditContent("")
  }

  function submitEdit() {
    const trimmed = editContent.trim()
    if (!trimmed || trimmed === message.content) {
      cancelEditing()
      return
    }

    const socket = getSocket()
    if (socket) {
      socket.emit(
        "edit_message",
        { messageId: message.id, conversationId: message.conversation_id, content: trimmed },
        (ack: { success: boolean; error?: string }) => {
          if (ack.success) {
            editMessage(message.conversation_id, message.id, trimmed)
          }
        }
      )
    }
    setIsEditing(false)
    setEditContent("")
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitEdit()
    }
    if (e.key === "Escape") {
      cancelEditing()
    }
  }

  const handleTouchStart = useCallback(() => {
    if (!canReply && !canEdit) return
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      // On mobile long-press: reply for other's messages, show both options for own
      if (canReply) {
        onReply?.(message)
      }
      if (navigator.vibrate) navigator.vibrate(30)
    }, LONG_PRESS_MS)
  }, [canReply, canEdit, message, onReply])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const isNudge = message.content === NUDGE_EMOJI && !message.is_deleted

  if (isNudge) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-3 py-1 md:px-4`}>
        <div className="flex flex-col items-center gap-0.5">
          <span className={`inline-block text-4xl ${isMine ? "animate-nudge-reverse" : "animate-nudge"}`}>{NUDGE_EMOJI}</span>
          <span className="text-muted-foreground text-[10px]">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
      </div>
    )
  }

  if (message.is_deleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-3 py-0.5 md:px-4`}>
        <div className="text-muted-foreground rounded-xl px-3 py-2 text-sm italic">
          Message deleted
        </div>
      </div>
    )
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={`group flex ${isMine ? "justify-end" : "justify-start"} px-3 py-0.5 md:px-4`}
    >
      {/* Action buttons — left side for own messages (desktop hover) */}
      {isMine && (canReply || canEdit) && (
        <div className="mr-1 hidden items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:flex group-hover:opacity-60">
          {canEdit && (
            <button onClick={startEditing} className="hover:!opacity-100">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          {canReply && (
            <button onClick={() => onReply?.(message)} className="hover:!opacity-100">
              <Reply className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      <div
        className="flex max-w-[85%] flex-col gap-0.5 select-none sm:max-w-[75%]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {/* Reply-to preview */}
        {message.reply_to_content && (
          <button
            onClick={() => message.reply_to_id && onScrollToMessage?.(message.reply_to_id)}
            className={`rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:opacity-80 ${isMine ? "bg-primary/20" : "bg-muted"}`}
          >
            <span className="text-muted-foreground font-medium">
              {message.reply_to_sender_username}
            </span>
            <p className="truncate">{message.reply_to_content}</p>
          </button>
        )}

        {/* Image message */}
        {message.message_type === "image" && message.image_url ? (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block cursor-zoom-in overflow-hidden rounded-xl"
            >
              <img
                src={message.image_url}
                alt="Shared image"
                className="max-h-64 w-auto rounded-xl object-cover"
                loading="lazy"
              />
            </button>
            {lightboxOpen && (
              <ImageLightbox
                src={message.image_url}
                onClose={() => setLightboxOpen(false)}
              />
            )}
          </>
        ) : isEditing ? (
          /* Edit mode */
          <div className={`rounded-xl border-2 border-primary px-3 py-2 ${
            isMine ? "bg-primary/10" : "bg-muted"
          }`}>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              autoFocus
              rows={1}
              className="w-full resize-none bg-transparent text-sm outline-none"
            />
            <div className="mt-1 flex justify-end gap-2">
              <button
                onClick={cancelEditing}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                className="text-xs font-medium text-primary hover:text-primary/80"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          /* Text message */
          <div
            className={`rounded-xl px-3 py-2 text-sm md:px-4 ${
              isMine
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        )}

        {/* Timestamp + status */}
        <div
          className={`flex items-center gap-1 px-1 ${isMine ? "justify-end" : "justify-start"}`}
        >
          {message.is_edited && (
            <span className="text-muted-foreground text-[10px] italic">edited</span>
          )}
          <span className="text-muted-foreground text-[10px]">
            {formatMessageTime(message.created_at)}
          </span>
          {isMine && message.status === "sending" && (
            <Clock className="text-muted-foreground h-3 w-3" />
          )}
          {isMine && message.status === "sent" && !message.readByOther && (
            <Check className="text-muted-foreground h-3 w-3" />
          )}
          {isMine && message.readByOther && (
            <CheckCheck className="h-3 w-3 text-blue-500" />
          )}
          {isMine && message.status === "failed" && (
            <AlertCircle className="h-3 w-3 text-destructive" />
          )}
        </div>
      </div>

      {/* Action buttons — right side for other's messages (desktop hover) */}
      {!isMine && canReply && (
        <button
          onClick={() => onReply?.(message)}
          className="ml-1 hidden self-center opacity-0 transition-opacity group-hover:block group-hover:opacity-60 hover:!opacity-100"
        >
          <Reply className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
