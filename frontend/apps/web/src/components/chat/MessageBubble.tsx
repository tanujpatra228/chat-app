import { formatMessageTime } from "@/utils/formatDate"
import type { Message } from "@/lib/types"
import { AlertCircle, Clock, Check } from "lucide-react"

interface MessageBubbleProps {
  message: Message
  isMine: boolean
}

export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  if (message.is_deleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-4 py-0.5`}>
        <div className="text-muted-foreground rounded-2xl px-4 py-2 text-sm italic">
          Message deleted
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-4 py-0.5`}>
      <div className="flex max-w-[75%] flex-col gap-0.5">
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
          className={`rounded-2xl px-4 py-2 text-sm ${
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
