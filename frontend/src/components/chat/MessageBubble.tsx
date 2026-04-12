import { formatMessageTime } from "@/utils/formatDate"
import type { Message } from "@/lib/types"
import { AlertCircle, Clock, Check } from "lucide-react"

interface MessageBubbleProps {
  message: Message
  isMine: boolean
}

const NUDGE_EMOJI = "\u{1F449}"

export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const isNudge = message.content === NUDGE_EMOJI && !message.is_deleted

  if (isNudge) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-3 py-1 md:px-4`}>
        <div className="flex flex-col items-center gap-0.5">
          <span className="animate-bounce text-4xl">{NUDGE_EMOJI}</span>
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
        <div className="text-muted-foreground rounded-2xl px-3 py-2 text-sm italic">
          Message deleted
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-3 py-0.5 md:px-4`}>
      <div className="flex max-w-[85%] flex-col gap-0.5 sm:max-w-[75%]">
        {message.reply_to_content && (
          <div
            className={`rounded-lg px-3 py-1.5 text-xs ${isMine ? "bg-primary/20" : "bg-muted"}`}
          >
            <span className="text-muted-foreground font-medium">
              {message.reply_to_sender_username}
            </span>
            <p className="truncate">{message.reply_to_content}</p>
          </div>
        )}
        <div
          className={`rounded-2xl px-3 py-2 text-sm md:px-4 ${
            isMine
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div
          className={`flex items-center gap-1 px-1 ${isMine ? "justify-end" : "justify-start"}`}
        >
          <span className="text-muted-foreground text-[10px]">
            {formatMessageTime(message.created_at)}
          </span>
          {isMine && message.status === "sending" && (
            <Clock className="text-muted-foreground h-3 w-3" />
          )}
          {isMine && message.status === "sent" && (
            <Check className="text-muted-foreground h-3 w-3" />
          )}
          {isMine && message.status === "failed" && (
            <AlertCircle className="h-3 w-3 text-destructive" />
          )}
        </div>
      </div>
    </div>
  )
}
