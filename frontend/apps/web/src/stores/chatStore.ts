import { create } from "zustand"
import type { Conversation, Message } from "@/lib/types"

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>

  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  addMessage: (conversationId: string, message: Message) => void
  replaceMessage: (
    conversationId: string,
    tempId: string,
    message: Message
  ) => void
  markMessageFailed: (conversationId: string, tempId: string) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  prependMessages: (conversationId: string, messages: Message[]) => void
  deleteMessage: (conversationId: string, messageId: string) => void
  updateConversationLastMessage: (
    conversationId: string,
    message: Message
  ) => void
  decrementUnread: (conversationId: string) => void
  incrementUnread: (conversationId: string) => void
  updateUserOnlineStatus: (
    userId: string,
    isOnline: boolean,
    lastSeen?: string
  ) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messages[conversationId] || []
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existing, message],
        },
      }
    }),

  replaceMessage: (conversationId, tempId, message) =>
    set((state) => {
      const existing = state.messages[conversationId] || []
      return {
        messages: {
          ...state.messages,
          [conversationId]: existing.map((m) =>
            m.tempId === tempId ? { ...message, status: "sent" as const } : m
          ),
        },
      }
    }),

  markMessageFailed: (conversationId, tempId) =>
    set((state) => {
      const existing = state.messages[conversationId] || []
      return {
        messages: {
          ...state.messages,
          [conversationId]: existing.map((m) =>
            m.tempId === tempId ? { ...m, status: "failed" as const } : m
          ),
        },
      }
    }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),

  prependMessages: (conversationId, messages) =>
    set((state) => {
      const existing = state.messages[conversationId] || []
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...messages, ...existing],
        },
      }
    }),

  deleteMessage: (conversationId, messageId) =>
    set((state) => {
      const existing = state.messages[conversationId] || []
      return {
        messages: {
          ...state.messages,
          [conversationId]: existing.map((m) =>
            m.id === messageId
              ? { ...m, is_deleted: true, content: "" }
              : m
          ),
        },
      }
    }),

  updateConversationLastMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations
        .map((c) =>
          c.id === conversationId
            ? {
                ...c,
                last_message_id: message.id,
                last_message_content: message.content,
                last_message_sender_id: message.sender_id,
                last_message_at: message.created_at,
                last_message_is_deleted: message.is_deleted,
              }
            : c
        )
        .sort(
          (a, b) =>
            new Date(b.last_message_at || b.created_at).getTime() -
            new Date(a.last_message_at || a.created_at).getTime()
        ),
    })),

  decrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ),
    })),

  incrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, unread_count: c.unread_count + 1 }
          : c
      ),
    })),

  updateUserOnlineStatus: (userId, isOnline, lastSeen) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.other_user_id === userId
          ? {
              ...c,
              other_is_online: isOnline,
              ...(lastSeen ? { other_last_seen: lastSeen } : {}),
            }
          : c
      ),
    })),
}))
