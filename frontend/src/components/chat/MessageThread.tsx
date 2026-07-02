import { useEffect, useRef, useCallback, useState, Fragment } from "react"
import { Loader2, ImageUp, Video, Music2 } from "lucide-react"
import { ChatHeader } from "./ChatHeader"
import { MessageBubble } from "./MessageBubble"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { useTyping } from "@/hooks/useTyping"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { getSocket } from "@/lib/socket"
import { bgThumbnailUrl } from "@/utils/cloudinary"
import type { Conversation, Message } from "@/lib/types"
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller"
import { Marker, MarkerContent } from "@/components/ui/marker"

interface MessageThreadProps {
  conversation: Conversation
  onBack?: () => void
}

const defaultNudgeType = import.meta.env.VITE_DEFAULT_NUDGE_TYPE === "heart" ? "heart" : "point"
const LOAD_MORE_ROOT_MARGIN = "400px 0px 0px 0px"

function getDateLabel(isoString: string): string {
  const date = new Date(isoString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  })
}

export function MessageThread({ conversation, onBack }: MessageThreadProps) {
  const { user } = useAuthStore()
  const { setReplyTo, decrementUnread, editMessage, addMessage, updateConversationLastMessage } = useChatStore()
  const { messages, isLoading, hasMore, loadMore, sendMessage, retryMessage, removeFailedMessage } = useMessages(
    conversation.id
  )
  const { emitTypingStart, stopTyping, typingUsers } = useTyping(conversation.id)
  const lastTapRef = useRef(0)
  const [uploadState, setUploadState] = useState<{ progress: number; mediaType: string } | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [nudgeType, setNudgeType] = useState<"point" | "heart">(defaultNudgeType)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null)

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

  // Locate the viewport element after mount (used as IntersectionObserver root)
  useEffect(() => {
    const el = document.querySelector("[data-slot=message-scroller-viewport]") as HTMLDivElement | null
    if (el) setViewportEl(el)
  }, [])

  // Fire loadMore when top sentinel enters within 400px of the viewport top
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !viewportEl) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { root: viewportEl, rootMargin: LOAD_MORE_ROOT_MARGIN }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [viewportEl, hasMore, isLoading, loadMore])

  // Clear unread count when opening conversation
  useEffect(() => {
    decrementUnread(conversation.id)
  }, [conversation.id, decrementUnread])

  // Emit mark_read for latest received message
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
      const mediaLabel =
        message.message_type === "image" ? "📷 Photo" :
        message.message_type === "video" ? "🎥 Video" :
        message.message_type === "audio" ? "🎵 Audio" : null
      setReplyTo({
        messageId: message.id,
        content: mediaLabel ?? message.content,
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

  const handleMediaUploaded = useCallback((message: Message) => {
    const enriched: Message = {
      ...message,
      status: "sent",
      stableKey: message.id,
      sender_username: message.sender_username || user?.username || "",
      sender_display_name: message.sender_display_name ?? user?.displayName ?? null,
    }
    addMessage(conversation.id, enriched)
    updateConversationLastMessage(conversation.id, enriched)
  }, [conversation.id, user, addMessage, updateConversationLastMessage])

  const bgUrl = conversation.background_image_url

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Background layers */}
      {bgUrl ? (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src={bgThumbnailUrl(bgUrl)}
              className="h-full w-full scale-110 object-cover blur-[1px]"
              aria-hidden
              draggable={false}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-background/85" />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-background/55 backdrop-blur-sm" />
      )}

      {/* Content — sits above absolute bg layers */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ChatHeader
          conversation={conversation}
          onBack={onBack}
          typingUsers={typingUsers}
          nudgeType={nudgeType}
          onNudgeToggle={toggleNudgeType}
          hasBackground={!!bgUrl}
        />

        <MessageScrollerProvider autoScroll>
          <MessageScroller className="flex-1 min-h-0">
            <MessageScrollerViewport
              preserveScrollOnPrepend
              className="chat-hearts-bg py-2"
              onClick={handleDoubleTap}
            >
              <MessageScrollerContent>
                {/* Sentinel: IntersectionObserver fires loadMore when within 400px of viewport top */}
                <div ref={sentinelRef} className="h-0 w-full" />

                {isLoading && hasMore && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!isLoading && messages.length === 0 && uploadState === null && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <p className="text-muted-foreground text-sm">
                      No messages yet. Say hello!
                    </p>
                  </div>
                )}

                {messages.map((message, i) => {
                  const prevMessage = messages[i - 1]
                  const showDateSep =
                    !prevMessage ||
                    new Date(message.created_at).toDateString() !==
                      new Date(prevMessage.created_at).toDateString()

                  return (
                    <Fragment key={message.stableKey}>
                      {showDateSep && (
                        <Marker variant="separator" className="px-3 py-1 md:px-4">
                          <MarkerContent className="text-[11px]">
                            {getDateLabel(message.created_at)}
                          </MarkerContent>
                        </Marker>
                      )}
                      <MessageScrollerItem
                        id={`msg-${message.id}`}
                        messageId={message.stableKey}
                        className="pb-1.5"
                      >
                        <MessageBubble
                          message={message}
                          isMine={message.sender_id === user?.id}
                          onReply={handleReply}
                          onScrollToMessage={handleScrollToMessage}
                          onEdit={handleEdit}
                          onRetry={retryMessage}
                          onRemoveFailed={removeFailedMessage}
                        />
                      </MessageScrollerItem>
                    </Fragment>
                  )
                })}

                {/* Upload progress bubble */}
                {uploadState !== null && (
                  <div className="flex justify-end px-3 py-1 md:px-4">
                    <div className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5">
                      {uploadState.mediaType.startsWith("video") ? (
                        <Video className="h-4 w-4 text-primary-foreground" />
                      ) : uploadState.mediaType.startsWith("audio") ? (
                        <Music2 className="h-4 w-4 text-primary-foreground" />
                      ) : (
                        <ImageUp className="h-4 w-4 text-primary-foreground" />
                      )}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-primary-foreground">
                          {uploadState.progress > 0 ? `Uploading... ${uploadState.progress}%` : "Uploading..."}
                        </span>
                        {uploadState.progress > 0 ? (
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-primary-foreground/30">
                            <div
                              className="h-full rounded-full bg-primary-foreground transition-all duration-200"
                              style={{ width: `${uploadState.progress}%` }}
                            />
                          </div>
                        ) : (
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-primary-foreground/30">
                            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>

            {/* Scroll-to-bottom button — appears when user scrolls up */}
            <MessageScrollerButton direction="end" />
          </MessageScroller>
        </MessageScrollerProvider>

        <MessageInput
          conversationId={conversation.id}
          onSend={sendMessage}
          onTyping={emitTypingStart}
          onStopTyping={stopTyping}
          onUploadStart={(mediaType) => setUploadState({ progress: 0, mediaType })}
          onUploadProgress={(p) => setUploadState(prev => prev ? { ...prev, progress: p } : null)}
          onUploadEnd={() => setUploadState(null)}
          onMediaUploaded={handleMediaUploaded}
          mode={editingMessage ? "edit" : "send"}
          editingMessage={editingMessage || undefined}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
        />
      </div>
    </div>
  )
}
