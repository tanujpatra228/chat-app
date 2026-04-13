import { useEffect, useRef, useCallback, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Button } from "@/components/ui/button"
import { Loader2, ImageUp } from "lucide-react"
import { ChatHeader } from "./ChatHeader"
import { MessageBubble } from "./MessageBubble"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { useTyping } from "@/hooks/useTyping"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { getSocket } from "@/lib/socket"
import type { Conversation, Message } from "@/lib/types"

interface MessageThreadProps {
  conversation: Conversation
  onBack?: () => void
}

export function MessageThread({ conversation, onBack }: MessageThreadProps) {
  const { user } = useAuthStore()
  const { setReplyTo, decrementUnread } = useChatStore()
  const { messages, isLoading, hasMore, loadMore, sendMessage } = useMessages(
    conversation.id
  )
  const { emitTypingStart, stopTyping, typingUsers } = useTyping(conversation.id)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(0)
  const lastTapRef = useRef(0)
  const shouldScrollRef = useRef(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 60,
    overscan: 10,
  })

  const handleDoubleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("button, textarea, input, a")) return

      const now = Date.now()
      if (now - lastTapRef.current < 300) {
        sendMessage("\u{1F449}")
        lastTapRef.current = 0
      } else {
        lastTapRef.current = now
      }
    },
    [sendMessage]
  )

  // Scroll to bottom on new messages (only if user was already at bottom)
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && shouldScrollRef.current) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: "end" })
      })
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length, virtualizer])

  // Track if user is near bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    function handleScroll() {
      if (!container) return
      const { scrollTop, scrollHeight, clientHeight } = container
      shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 100
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  // Clear unread count immediately when opening a conversation
  useEffect(() => {
    decrementUnread(conversation.id)
  }, [conversation.id, decrementUnread])

  // Emit mark_read for the latest message from the other user
  useEffect(() => {
    if (!messages.length || !user) return

    // Find the last message from the other user
    const lastOtherMessage = [...messages]
      .reverse()
      .find((m) => m.sender_id !== user.id && !m.tempId)

    if (!lastOtherMessage) return

    const socket = getSocket()
    if (socket) {
      socket.emit("mark_read", {
        conversationId: conversation.id,
        messageId: lastOtherMessage.id,
      })
    }
  }, [messages, user, conversation.id])

  const handleReply = useCallback(
    (message: Message) => {
      setReplyTo({
        messageId: message.id,
        content: message.content,
        senderUsername: message.sender_username || "Unknown",
      })
    },
    [setReplyTo]
  )

  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      const index = messages.findIndex((m) => m.id === messageId)
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: "center" })
        // Highlight after scroll
        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = document.getElementById(`msg-${messageId}`)
            if (el) {
              el.classList.add("bg-accent/50")
              setTimeout(() => el.classList.remove("bg-accent/50"), 1500)
            }
          }, 100)
        })
      }
    },
    [messages, virtualizer]
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        typingUsers={typingUsers}
      />

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto py-2"
        onClick={handleDoubleTap}
      >
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

        {!isLoading && messages.length === 0 && uploadProgress === null && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              No messages yet. Say hello!
            </p>
          </div>
        )}

        {messages.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const message = messages[virtualItem.index]
              return (
                <div
                  key={message.tempId || message.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <MessageBubble
                    message={message}
                    isMine={message.sender_id === user?.id}
                    onReply={handleReply}
                    onScrollToMessage={handleScrollToMessage}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Upload progress bubble */}
        {uploadProgress !== null && (
          <div className="flex justify-end px-3 py-1 md:px-4">
            <div className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5">
              <ImageUp className="h-4 w-4 text-primary-foreground" />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-primary-foreground">
                  Uploading... {uploadProgress}%
                </span>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-primary-foreground/30">
                  <div
                    className="h-full rounded-full bg-primary-foreground transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <MessageInput
        conversationId={conversation.id}
        onSend={sendMessage}
        onTyping={emitTypingStart}
        onStopTyping={stopTyping}
        onUploadStart={() => setUploadProgress(0)}
        onUploadProgress={(p) => setUploadProgress(p)}
        onUploadEnd={() => setUploadProgress(null)}
      />
    </div>
  )
}
