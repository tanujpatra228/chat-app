import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { ChatHeader } from "./ChatHeader"
import { MessageBubble } from "./MessageBubble"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { useAuthStore } from "@/stores/authStore"
import type { Conversation } from "@/lib/types"

interface MessageThreadProps {
  conversation: Conversation
  onBack?: () => void
}

export function MessageThread({ conversation, onBack }: MessageThreadProps) {
  const { user } = useAuthStore()
  const { messages, isLoading, hasMore, loadMore, sendMessage } = useMessages(
    conversation.id
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(0)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  return (
    <div className="flex h-full flex-col bg-background">
      <ChatHeader conversation={conversation} onBack={onBack} />

      <ScrollArea className="flex-1 py-2">
        {hasMore && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Load earlier messages
            </Button>
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              No messages yet. Say hello!
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.tempId || message.id}
            message={message}
            isMine={message.sender_id === user?.id}
          />
        ))}

        <div ref={bottomRef} />
      </ScrollArea>

      <MessageInput onSend={sendMessage} />
    </div>
  )
}
