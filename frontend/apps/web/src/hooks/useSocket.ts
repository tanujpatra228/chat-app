import { useEffect } from "react"
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
  } = useChatStore()

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

      if (conversationId !== activeConversationId) {
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

    socket.on("new_message", handleNewMessage)
    socket.on("message_deleted", handleMessageDeleted)
    socket.on("user_online", handleUserOnline)
    socket.on("user_offline", handleUserOffline)

    return () => {
      socket.off("new_message", handleNewMessage)
      socket.off("message_deleted", handleMessageDeleted)
      socket.off("user_online", handleUserOnline)
      socket.off("user_offline", handleUserOffline)
    }
  }, [
    isAuthenticated,
    activeConversationId,
    addMessage,
    deleteMessage,
    updateConversationLastMessage,
    incrementUnread,
    updateUserOnlineStatus,
  ])
}
