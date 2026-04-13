import { create } from "zustand"
import type { Conversation, Message } from "@/lib/types"

interface TypingUser {
  userId: string
  username: string
  expiresAt: number
}

interface ReplyTo {
  messageId: string
  content: string
  senderUsername: string
}

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>
  typingUsers: Record<string, TypingUser[]>
  replyTo: ReplyTo | null
  lastReadMessageIds: Record<string, string>

  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  addMessage: (conversationId: string, message: Message) => void
  replaceMessage: (conversationId: string, tempId: string, message: Message) => void
  markMessageFailed: (conversationId: string, tempId: string) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  prependMessages: (conversationId: string, messages: Message[]) => void
  deleteMessage: (conversationId: string, messageId: string) => void
  updateConversationLastMessage: (conversationId: string, message: Message) => void
  decrementUnread: (conversationId: string) => void
  incrementUnread: (conversationId: string) => void
  updateUserOnlineStatus: (userId: string, isOnline: boolean, lastSeen?: string) => void
  setTypingUser: (conversationId: string, userId: string, username: string) => void
  clearTypingUser: (conversationId: string, userId: string) => void
  setReplyTo: (replyTo: ReplyTo | null) => void
  setLastReadMessageId: (conversationId: string, userId: string, messageId: string) => void
  markMessagesRead: (conversationId: string, upToMessageId: string) => void
  updateVanishingMode: (conversationId: string, vanishingMode: boolean, durationHours: number | null) => void
  editMessage: (conversationId: string, messageId: string, newContent: string) => void
}

const TYPING_EXPIRY_MS = 4000

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  replyTo: null,
  lastReadMessageIds: {},

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id, replyTo: null }),

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
            m.tempId === tempId
              ? {
                  ...m,
                  ...message,
                  tempId: undefined,
                  sender_username: message.sender_username || m.sender_username,
                  sender_display_name: message.sender_display_name || m.sender_display_name,
                  reply_to_content: message.reply_to_content || m.reply_to_content,
                  reply_to_sender_username: message.reply_to_sender_username || m.reply_to_sender_username,
                  status: "sent" as const,
                }
              : m
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

  setTypingUser: (conversationId, userId, username) =>
    set((state) => {
      const existing = state.typingUsers[conversationId] || []
      const filtered = existing.filter((t) => t.userId !== userId)
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: [
            ...filtered,
            { userId, username, expiresAt: Date.now() + TYPING_EXPIRY_MS },
          ],
        },
      }
    }),

  clearTypingUser: (conversationId, userId) =>
    set((state) => {
      const existing = state.typingUsers[conversationId] || []
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: existing.filter((t) => t.userId !== userId),
        },
      }
    }),

  setReplyTo: (replyTo) => set({ replyTo }),

  setLastReadMessageId: (conversationId, _userId, messageId) =>
    set((state) => ({
      lastReadMessageIds: {
        ...state.lastReadMessageIds,
        [conversationId]: messageId,
      },
    })),

  markMessagesRead: (conversationId, upToMessageId) =>
    set((state) => {
      const msgs = state.messages[conversationId] || []
      let found = false
      return {
        messages: {
          ...state.messages,
          [conversationId]: msgs.map((m) => {
            if (m.id === upToMessageId) found = true
            if (!found) return { ...m, readByOther: true }
            if (m.id === upToMessageId) return { ...m, readByOther: true }
            return m
          }),
        },
      }
    }),

  updateVanishingMode: (conversationId, vanishingMode, durationHours) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, vanishing_mode: vanishingMode, vanishing_duration_hours: durationHours }
          : c
      ),
    })),

  editMessage: (conversationId, messageId, newContent) =>
    set((state) => {
      const existing = state.messages[conversationId] || []
      return {
        messages: {
          ...state.messages,
          [conversationId]: existing.map((m) =>
            m.id === messageId
              ? { ...m, content: newContent, is_edited: true }
              : m
          ),
        },
      }
    }),
}))
