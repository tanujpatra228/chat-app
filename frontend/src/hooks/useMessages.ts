import { useEffect, useState, useCallback, useRef } from "react"
import api from "@/lib/api"
import { getSocket } from "@/lib/socket"
import { useChatStore } from "@/stores/chatStore"
import { useAuthStore } from "@/stores/authStore"

export function useMessages(conversationId: string | null) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const cursorRef = useRef<string | null>(null)
  const { user } = useAuthStore()
  const {
    messages,
    setMessages,
    prependMessages,
    addMessage,
    replaceMessage,
    markMessageFailed,
  } = useChatStore()

  const conversationMessages = conversationId
    ? messages[conversationId] || []
    : []

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return

    setIsLoading(true)
    try {
      const { data } = await api.get(
        `/conversations/${conversationId}/messages`
      )
      // Messages come in DESC order, reverse for chronological display
      setMessages(conversationId, data.messages.reverse())
      setHasMore(data.hasMore)
      cursorRef.current = data.nextCursor
    } catch (err) {
      console.error("Failed to fetch messages:", err)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, setMessages])

  const loadMore = useCallback(async () => {
    if (!conversationId || !cursorRef.current || isLoading) return

    setIsLoading(true)
    try {
      const { data } = await api.get(
        `/conversations/${conversationId}/messages`,
        { params: { cursor: cursorRef.current } }
      )
      prependMessages(conversationId, data.messages.reverse())
      setHasMore(data.hasMore)
      cursorRef.current = data.nextCursor
    } catch (err) {
      console.error("Failed to load more messages:", err)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, isLoading, prependMessages])

  const sendMessage = useCallback(
    (content: string, replyToId?: string) => {
      if (!conversationId || !user) return

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const optimisticMessage = {
        id: tempId,
        tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        reply_to_id: replyToId || null,
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
