import { useEffect, useRef } from "react"
import { getSocket } from "@/lib/socket"
import { useChatStore } from "@/stores/chatStore"
import { useAuthStore } from "@/stores/authStore"
import type { Message } from "@/lib/types"

export function useSocket() {
  const { isAuthenticated } = useAuthStore()
  const {
    activeConversationId,
    addMessage,
    deleteMessage,
    updateConversationLastMessage,
    incrementUnread,
    updateUserOnlineStatus,
    setTypingUser,
    clearTypingUser,
    markMessagesRead,
    updateVanishingMode,
    editMessage,
  } = useChatStore()

  // Use ref to avoid stale closure for activeConversationId
  const activeConversationIdRef = useRef(activeConversationId)
  activeConversationIdRef.current = activeConversationId

  useEffect(() => {
    if (!isAuthenticated) return

    const socket = getSocket()
    if (!socket) return

    const handleNewMessage = ({
      conversationId,
      message,
    }: {
      conversationId: string
      message: Message
    }) => {
      addMessage(conversationId, { ...message, status: "sent" })
      updateConversationLastMessage(conversationId, message)
      // Clear typing when a message arrives from that user
      clearTypingUser(conversationId, message.sender_id)

      if (conversationId !== activeConversationIdRef.current) {
        incrementUnread(conversationId)
      }
    }

    const handleMessageDeleted = ({
      conversationId,
      messageId,
    }: {
      conversationId: string
      messageId: string
    }) => {
      deleteMessage(conversationId, messageId)
    }

    const handleUserOnline = ({ userId }: { userId: string }) => {
      updateUserOnlineStatus(userId, true)
    }

    const handleUserOffline = ({
      userId,
      lastSeen,
    }: {
      userId: string
      lastSeen: string
    }) => {
      updateUserOnlineStatus(userId, false, lastSeen)
    }

    const handleUserTyping = ({
      conversationId,
      userId,
      username,
    }: {
      conversationId: string
      userId: string
      username: string
    }) => {
      setTypingUser(conversationId, userId, username)
    }

    const handleUserStoppedTyping = ({
      conversationId,
      userId,
    }: {
      conversationId: string
      userId: string
    }) => {
      clearTypingUser(conversationId, userId)
    }

    const handleMessagesRead = ({
      conversationId,
      lastReadMessageId,
    }: {
      conversationId: string
      userId: string
      lastReadMessageId: string
    }) => {
      markMessagesRead(conversationId, lastReadMessageId)
    }

    const handleMessageEdited = ({
      conversationId,
      messageId,
      content,
    }: {
      conversationId: string
      messageId: string
      content: string
    }) => {
      editMessage(conversationId, messageId, content)
    }

    const handleVanishingModeChanged = ({
      conversationId,
      vanishingMode,
      durationHours,
    }: {
      conversationId: string
      vanishingMode: boolean
      durationHours: number | null
      changedByUserId: string
    }) => {
      updateVanishingMode(conversationId, vanishingMode, durationHours)
    }

    socket.on("new_message", handleNewMessage)
    socket.on("message_deleted", handleMessageDeleted)
    socket.on("user_online", handleUserOnline)
    socket.on("user_offline", handleUserOffline)
    socket.on("user_typing", handleUserTyping)
    socket.on("user_stopped_typing", handleUserStoppedTyping)
    socket.on("messages_read", handleMessagesRead)
    socket.on("vanishing_mode_changed", handleVanishingModeChanged)
    socket.on("message_edited", handleMessageEdited)

    return () => {
      socket.off("new_message", handleNewMessage)
      socket.off("message_deleted", handleMessageDeleted)
      socket.off("user_online", handleUserOnline)
      socket.off("user_offline", handleUserOffline)
      socket.off("user_typing", handleUserTyping)
      socket.off("user_stopped_typing", handleUserStoppedTyping)
      socket.off("messages_read", handleMessagesRead)
      socket.off("vanishing_mode_changed", handleVanishingModeChanged)
      socket.off("message_edited", handleMessageEdited)
    }
  }, [
    isAuthenticated,
    addMessage,
    deleteMessage,
    updateConversationLastMessage,
    incrementUnread,
    updateUserOnlineStatus,
    setTypingUser,
    clearTypingUser,
    markMessagesRead,
    updateVanishingMode,
    editMessage,
  ])
}
