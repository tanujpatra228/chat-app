import { useRef, useCallback, useState } from "react"
import { formatMessageTime } from "@/utils/formatDate"
import type { Message } from "@/lib/types"
import { AlertCircle, Clock, Check, CheckCheck, Reply } from "lucide-react"
import { ImageLightbox } from "./ImageLightbox"

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

  const canReply = !!onReply && !message.tempId && !message.is_deleted

  const handleTouchStart = useCallback(() => {
    if (!canReply) return
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onReply?.(message)
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(30)
    }, LONG_PRESS_MS)
  }, [canReply, message, onReply])

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
      {/* Reply button — left side for own messages (desktop hover) */}
      {isMine && canReply && (
        <button
          onClick={() => onReply(message)}
          className="mr-1 hidden self-center opacity-0 transition-opacity group-hover:block group-hover:opacity-60 hover:!opacity-100"
        >
          <Reply className="h-4 w-4 text-muted-foreground" />
        </button>
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
        ) : (
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
        <div
          className={`flex items-center gap-1 px-1 ${isMine ? "justify-end" : "justify-start"}`}
        >
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

      {/* Reply button — right side for other's messages (desktop hover) */}
      {!isMine && canReply && (
        <button
          onClick={() => onReply(message)}
          className="ml-1 hidden self-center opacity-0 transition-opacity group-hover:block group-hover:opacity-60 hover:!opacity-100"
        >
          <Reply className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
