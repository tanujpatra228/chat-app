import { useRef, useCallback, useState } from "react"
import { formatMessageTime } from "@/utils/formatDate"
import type { Message } from "@/lib/types"
import { AlertCircle, Clock, Check, CheckCheck, Reply, Pencil } from "lucide-react"
import { ImageLightbox } from "./ImageLightbox"

interface MessageBubbleProps {
  message: Message
  isMine: boolean
  onReply?: (message: Message) => void
  onScrollToMessage?: (messageId: string) => void
  onEdit?: (message: Message) => void
}

const NUDGE_EMOJI = "\u{1F449}"
const LONG_PRESS_MS = 500

export function MessageBubble({
  message,
  isMine,
  onReply,
  onScrollToMessage,
  onEdit,
}: MessageBubbleProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const didLongPress = useRef(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const canReply = !!onReply && !message.tempId && !message.is_deleted
  const canEdit =
    isMine &&
    !!onEdit &&
    !message.is_deleted &&
    !message.tempId &&
    message.message_type !== "image" &&
    message.message_type !== "nudge" &&
    message.content !== NUDGE_EMOJI

  const handleTouchStart = useCallback(() => {
    if (!canReply && !canEdit) return
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      if (navigator.vibrate) navigator.vibrate(30)

      // Own message with edit available: show action menu
      if (isMine && (canReply || canEdit)) {
        setShowActions(true)
      } else if (canReply) {
        // Other's message: reply directly
        onReply?.(message)
      }
    }, LONG_PRESS_MS)
  }, [canReply, canEdit, isMine, message, onReply])

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

  const isNudge = message.message_type === "nudge" && !message.is_deleted

  if (isNudge) {
    const nudgeEmoji = message.nudge_type === "heart" ? "♥️" : "👉"
    const animationClass = message.nudge_type === "heart" 
      ? (isMine ? "animate-heartbeat-reverse" : "animate-heartbeat")
      : (isMine ? "animate-nudge-reverse" : "animate-nudge")
    
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-3 md:px-4`}>
        <div className="flex flex-col items-center">
          <span className={`inline-block text-4xl ${animationClass}`}>{nudgeEmoji}</span>
          <span className="text-muted-foreground text-[10px] mt-0.5">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
      </div>
    )
  }

  if (message.is_deleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-3 md:px-4`}>
        <div className="text-muted-foreground rounded-xl px-3 py-2 text-sm italic">
          Message deleted
        </div>
      </div>
    )
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={`group flex ${isMine ? "justify-end" : "justify-start"} px-3 md:px-4`}
    >
      {/* Action buttons — left side for own messages (desktop hover) */}
      {isMine && (canReply || canEdit) && (
        <div className="mr-1 hidden items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:flex group-hover:opacity-60">
          {canEdit && (
            <button onClick={() => onEdit?.(message)} className="hover:!opacity-100">
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
        className="relative flex max-w-[85%] flex-col select-none sm:max-w-[75%]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {/* Reply-to preview */}
        {message.reply_to_content && (
          <button
            onClick={() => message.reply_to_id && onScrollToMessage?.(message.reply_to_id)}
            className={`rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:opacity-80 mb-1 ${isMine ? "bg-primary/20" : "bg-muted"}`}
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
                onLoad={() => {
                  requestAnimationFrame(() => {
                    window.dispatchEvent(new Event('resize'))
                  })
                }}
              />
            </button>
            {lightboxOpen && (
              <ImageLightbox
                src={message.image_url}
                onClose={() => setLightboxOpen(false)}
              />
            )}
          </>
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

        {/* Mobile action menu (shown on long-press for own messages) */}
        {showActions && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowActions(false)}
            />
            <div className={`absolute -top-9 z-50 flex gap-1 rounded-lg border bg-popover p-1 shadow-lg ${isMine ? "right-0" : "left-0"}`}>
              {canReply && (
                <button
                  onClick={() => {
                    setShowActions(false)
                    onReply?.(message)
                  }}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <Reply className="h-3.5 w-3.5" />
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => {
                    setShowActions(false)
                    onEdit?.(message)
                  }}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </>
        )}

        {/* Timestamp + status */}
        <div
          className={`flex items-center gap-1 px-1 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}
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
