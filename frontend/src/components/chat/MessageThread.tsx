import { useEffect, useRef, useCallback, useState, useLayoutEffect } from "react"
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

const defaultNudgeType = import.meta.env.VITE_DEFAULT_NUDGE_TYPE === "heart" ? "heart" : "point"
const SCROLL_BOTTOM_THRESHOLD_PX = 120
const LOAD_MORE_THRESHOLD_PX = 200

export function MessageThread({ conversation, onBack }: MessageThreadProps) {
  const { user } = useAuthStore()
  const { setReplyTo, decrementUnread, editMessage } = useChatStore()
  const { messages, isLoading, hasMore, loadMore, sendMessage } = useMessages(
    conversation.id
  )
  const { emitTypingStart, stopTyping, typingUsers } = useTyping(conversation.id)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef(0)
  const shouldScrollRef = useRef(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [nudgeType, setNudgeType] = useState<"point" | "heart">(defaultNudgeType)

  // Track for scroll-position preservation on prepend (older messages)
  const prevFirstIdRef = useRef<string | null>(null)
  const prevMessageCountRef = useRef(0)
  const savedScrollHeightRef = useRef(0)
  const didInitialScrollRef = useRef(false)

  const toggleNudgeType = useCallback(() => {
    setNudgeType(prev => prev === "point" ? "heart" : "point")
  }, [])

  const handleDoubleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("button, textarea, input, a")) return

      const now = Date.now()
      if (now - lastTapRef.current < 300) {
        sendMessage("", undefined, undefined, undefined, nudgeType)
        lastTapRef.current = 0
      } else {
        lastTapRef.current = now
      }
    },
    [sendMessage, nudgeType]
  )

  // Before the DOM updates with new prepended items, save scrollHeight so we can offset
  // We do this inside handleScroll's loadMore trigger — see below
  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const currentFirstId = messages[0]?.id ?? null
    const prevFirstId = prevFirstIdRef.current
    const prevCount = prevMessageCountRef.current

    // Initial load: scroll to bottom once
    if (!didInitialScrollRef.current && messages.length > 0) {
      container.scrollTop = container.scrollHeight
      didInitialScrollRef.current = true
      prevFirstIdRef.current = currentFirstId
      prevMessageCountRef.current = messages.length
      return
    }

    // Prepend detected: first message id changed AND count grew
    if (
      prevFirstId &&
      currentFirstId &&
      prevFirstId !== currentFirstId &&
      messages.length > prevCount
    ) {
      const diff = container.scrollHeight - savedScrollHeightRef.current
      container.scrollTop += diff
    } else if (messages.length > prevCount && shouldScrollRef.current) {
      // Append: scroll to bottom if user was near bottom
      container.scrollTop = container.scrollHeight
    }

    prevFirstIdRef.current = currentFirstId
    prevMessageCountRef.current = messages.length
  }, [messages])

  // Reset on conversation change
  useEffect(() => {
    didInitialScrollRef.current = false
    prevFirstIdRef.current = null
    prevMessageCountRef.current = 0
    shouldScrollRef.current = true
  }, [conversation.id])

  // Scroll listener: track near-bottom flag, auto-load more on near-top
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    function handleScroll() {
      if (!container) return
      const { scrollTop, scrollHeight, clientHeight } = container
      shouldScrollRef.current =
        scrollHeight - scrollTop - clientHeight < SCROLL_BOTTOM_THRESHOLD_PX

      if (scrollTop < LOAD_MORE_THRESHOLD_PX && hasMore && !isLoading) {
        savedScrollHeightRef.current = scrollHeight
        loadMore()
      }
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [hasMore, isLoading, loadMore])

  // Clear unread count immediately when opening a conversation
  useEffect(() => {
    decrementUnread(conversation.id)
  }, [conversation.id, decrementUnread])

  // Emit mark_read for the latest message from the other user
  useEffect(() => {
    if (!messages.length || !user) return

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

  const handleEdit = useCallback((message: Message) => {
    setEditingMessage(message)
  }, [])

  const handleSaveEdit = useCallback((content: string) => {
    if (!editingMessage) return
    const socket = getSocket()
    if (socket) {
      socket.emit(
        "edit_message",
        { messageId: editingMessage.id, conversationId: conversation.id, content },
        (ack: { success: boolean; error?: string }) => {
          if (ack.success) {
            editMessage(conversation.id, editingMessage.id, content)
          }
        }
      )
    }
    setEditingMessage(null)
  }, [editingMessage, conversation.id, editMessage])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
  }, [])

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("bg-accent/50")
      setTimeout(() => el.classList.remove("bg-accent/50"), 1500)
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        typingUsers={typingUsers}
        nudgeType={nudgeType}
        onNudgeToggle={toggleNudgeType}
      />

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto py-2"
        onClick={handleDoubleTap}
      >
        {isLoading && hasMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && messages.length === 0 && uploadProgress === null && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              No messages yet. Say hello!
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.stableKey} className="pb-1.5">
            <MessageBubble
              message={message}
              isMine={message.sender_id === user?.id}
              onReply={handleReply}
              onScrollToMessage={handleScrollToMessage}
              onEdit={handleEdit}
            />
          </div>
        ))}

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
        mode={editingMessage ? 'edit' : 'send'}
        editingMessage={editingMessage || undefined}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
      />
    </div>
  )
}
