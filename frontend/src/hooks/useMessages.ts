import { useEffect, useState, useCallback, useRef } from "react"
import api from "@/lib/api"
import { getSocket } from "@/lib/socket"
import { useChatStore } from "@/stores/chatStore"
import { useAuthStore } from "@/stores/authStore"
import type { Message } from "@/lib/types"

// --- Failed message localStorage helpers ---
const FAILED_KEY = "failed-messages"

interface FailedEntry {
  tempId: string
  conversationId: string
  content: string
  replyToId?: string
  replyToContent?: string
  replyToSenderUsername?: string
  nudgeType?: "point" | "heart"
  created_at: string
  sender_id: string
  sender_username: string
  sender_display_name: string | null
}

function loadFailed(): Record<string, FailedEntry[]> {
  try {
    return JSON.parse(localStorage.getItem(FAILED_KEY) || "{}")
  } catch {
    return {}
  }
}

function saveFailed(all: Record<string, FailedEntry[]>) {
  try {
    localStorage.setItem(FAILED_KEY, JSON.stringify(all))
  } catch {}
}

function addFailedEntry(entry: FailedEntry) {
  const all = loadFailed()
  all[entry.conversationId] = [...(all[entry.conversationId] || []), entry]
  saveFailed(all)
}

function removeFailedEntry(conversationId: string, tempId: string) {
  const all = loadFailed()
  all[conversationId] = (all[conversationId] || []).filter((e) => e.tempId !== tempId)
  if (!all[conversationId].length) delete all[conversationId]
  saveFailed(all)
}

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
    reconnectNonce,
    setMessages,
    prependMessages,
    addMessage,
    replaceMessage,
    markMessageFailed,
    setMessageSending,
    removeMessages,
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
      const withReadStatus = applyReadStatus(reversed, user.id, otherLastReadMessageId).map(m => ({ ...m, stableKey: m.id }))
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
      const withReadStatus = applyReadStatus(reversed, user.id, otherLastReadMessageId).map(m => ({ ...m, stableKey: m.id }))
      prependMessages(conversationId, withReadStatus)
      setHasMore(data.hasMore)
      cursorRef.current = data.nextCursor
    } catch (err) {
      console.error("Failed to load more messages:", err)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, isLoading, user, otherLastReadMessageId, prependMessages])

  function emitSend(
    tempId: string,
    content: string,
    replyToId: string | undefined,
    nudgeType: "point" | "heart" | undefined,
    isNudge: boolean,
    entry: FailedEntry
  ) {
    const socket = getSocket()
    if (!socket) {
      markMessageFailed(conversationId!, tempId)
      addFailedEntry(entry)
      return
    }
    socket.emit(
      "send_message",
      {
        conversationId,
        content: isNudge ? (nudgeType === "heart" ? "♥️" : "👉") : content,
        replyToId,
        nudgeType,
      },
      (ack: { success: boolean; message?: any; error?: string }) => {
        if (ack.success && ack.message) {
          replaceMessage(conversationId!, tempId, ack.message)
          removeFailedEntry(conversationId!, tempId)
        } else {
          markMessageFailed(conversationId!, tempId)
          addFailedEntry(entry)
        }
      }
    )
  }

  const sendMessage = useCallback(
    (content: string, replyToId?: string, replyToContent?: string, replyToSenderUsername?: string, nudgeType?: "point" | "heart") => {
      if (!conversationId || !user) return

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const isNudge = nudgeType !== undefined
      const optimisticMessage = {
        id: tempId,
        tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        content: isNudge ? (nudgeType === "heart" ? "♥️" : "👉") : content,
        reply_to_id: replyToId || null,
        reply_to_content: replyToContent || null,
        reply_to_sender_username: replyToSenderUsername || null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender_username: user.username,
        sender_display_name: user.displayName,
        status: "sending" as const,
        stableKey: tempId,
        message_type: isNudge ? "nudge" as const : "text" as const,
        nudge_type: nudgeType,
      }

      addMessage(conversationId, optimisticMessage)

      const entry: FailedEntry = {
        tempId,
        conversationId,
        content: isNudge ? (nudgeType === "heart" ? "♥️" : "👉") : content,
        replyToId,
        replyToContent,
        replyToSenderUsername,
        nudgeType,
        created_at: optimisticMessage.created_at,
        sender_id: user.id,
        sender_username: user.username,
        sender_display_name: user.displayName,
      }

      emitSend(tempId, content, replyToId, nudgeType, isNudge, entry)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, user, addMessage, replaceMessage, markMessageFailed]
  )

  // Load persisted failed messages after initial fetch
  useEffect(() => {
    if (!conversationId || !user) return
    const all = loadFailed()
    const failed = all[conversationId] || []
    for (const e of failed) {
      // Only add if not already in store (avoid duplicates on hot reload)
      const inStore = (messages[conversationId] || []).some((m) => m.tempId === e.tempId)
      if (!inStore) {
        addMessage(conversationId, {
          id: e.tempId,
          tempId: e.tempId,
          stableKey: e.tempId,
          conversation_id: e.conversationId,
          sender_id: e.sender_id,
          sender_username: e.sender_username,
          sender_display_name: e.sender_display_name,
          content: e.content,
          reply_to_id: e.replyToId || null,
          is_deleted: false,
          created_at: e.created_at,
          updated_at: e.created_at,
          status: "failed",
          message_type: "text",
        })
      }
    }
  // Run once per conversation load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const retryMessage = useCallback(
    (tempId: string) => {
      if (!conversationId) return
      const all = loadFailed()
      const entry = (all[conversationId] || []).find((e) => e.tempId === tempId)
      if (!entry) return

      setMessageSending(conversationId, tempId)
      const isNudge = entry.nudgeType !== undefined
      emitSend(tempId, entry.content, entry.replyToId, entry.nudgeType, isNudge, entry)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId]
  )

  const removeFailedMessage = useCallback(
    (tempId: string) => {
      if (!conversationId) return
      removeFailedEntry(conversationId, tempId)
      removeMessages(conversationId, [tempId])
    },
    [conversationId, removeMessages]
  )

  useEffect(() => {
    if (conversationId) {
      fetchMessages()
    }
  }, [conversationId, fetchMessages, reconnectNonce])

  return {
    messages: conversationMessages,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
    retryMessage,
    removeFailedMessage,
  }
}
