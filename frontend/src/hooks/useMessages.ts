import { useEffect, useState, useCallback, useRef } from "react"
import api from "@/lib/api"
import { getSocket } from "@/lib/socket"
import { useChatStore } from "@/stores/chatStore"
import { useAuthStore } from "@/stores/authStore"
import type { Message } from "@/lib/types"

function applyReadStatus(
  messages: Message[],
  userId: string,
  otherLastReadMessageId: string | null
): Message[] {
  if (!otherLastReadMessageId) return messages

  // Find the index of the last-read message
  const readIdx = messages.findIndex((m) => m.id === otherLastReadMessageId)
  if (readIdx === -1) {
    // The read marker might be for messages older than what's loaded,
    // meaning ALL loaded messages from this user are read
    return messages.map((m) =>
      m.sender_id === userId ? { ...m, readByOther: true } : m
    )
  }

  return messages.map((m, i) =>
    m.sender_id === userId && i <= readIdx ? { ...m, readByOther: true } : m
  )
}

export function useMessages(conversationId: string | null) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const cursorRef = useRef<string | null>(null)
  const { user } = useAuthStore()
  const {
    messages,
    conversations,
    setMessages,
    prependMessages,
    addMessage,
    replaceMessage,
    markMessageFailed,
  } = useChatStore()

  const conversation = conversations.find((c) => c.id === conversationId)
  const otherLastReadMessageId = conversation?.other_last_read_message_id ?? null

  const conversationMessages = conversationId
    ? messages[conversationId] || []
    : []

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return

    setIsLoading(true)
    try {
      const { data } = await api.get(
        `/conversations/${conversationId}/messages`
      )
      const reversed = data.messages.reverse()
      const withReadStatus = applyReadStatus(reversed, user.id, otherLastReadMessageId)
      setMessages(conversationId, withReadStatus)
      setHasMore(data.hasMore)
      cursorRef.current = data.nextCursor
    } catch (err) {
      console.error("Failed to fetch messages:", err)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, user, otherLastReadMessageId, setMessages])

  const loadMore = useCallback(async () => {
    if (!conversationId || !cursorRef.current || isLoading || !user) return

    setIsLoading(true)
    try {
      const { data } = await api.get(
        `/conversations/${conversationId}/messages`,
        { params: { cursor: cursorRef.current } }
      )
      const reversed = data.messages.reverse()
      const withReadStatus = applyReadStatus(reversed, user.id, otherLastReadMessageId)
      prependMessages(conversationId, withReadStatus)
      setHasMore(data.hasMore)
      cursorRef.current = data.nextCursor
    } catch (err) {
      console.error("Failed to load more messages:", err)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, isLoading, user, otherLastReadMessageId, prependMessages])

  const sendMessage = useCallback(
    (content: string, replyToId?: string, replyToContent?: string, replyToSenderUsername?: string) => {
      if (!conversationId || !user) return

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const optimisticMessage = {
        id: tempId,
        tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        reply_to_id: replyToId || null,
        reply_to_content: replyToContent || null,
        reply_to_sender_username: replyToSenderUsername || null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender_username: user.username,
        sender_display_name: user.displayName,
        status: "sending" as const,
      }

      addMessage(conversationId, optimisticMessage)

      const socket = getSocket()
      if (!socket) {
        markMessageFailed(conversationId, tempId)
        return
      }

      socket.emit(
        "send_message",
        { conversationId, content, replyToId },
        (ack: { success: boolean; message?: any; error?: string }) => {
          if (ack.success && ack.message) {
            replaceMessage(conversationId, tempId, ack.message)
          } else {
            markMessageFailed(conversationId, tempId)
          }
        }
      )
    },
    [conversationId, user, addMessage, replaceMessage, markMessageFailed]
  )

  useEffect(() => {
    if (conversationId) {
      fetchMessages()
    }
  }, [conversationId, fetchMessages])

  return {
    messages: conversationMessages,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
  }
}
