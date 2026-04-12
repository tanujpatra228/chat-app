export interface User {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  isOnline?: boolean
  lastSeen?: string
}

export interface AuthUser extends User {
  email: string
}

export interface Conversation {
  id: string
  created_at: string
  updated_at: string
  other_user_id: string
  other_username: string
  other_display_name: string | null
  other_avatar_url: string | null
  other_is_online: boolean
  other_last_seen: string
  last_message_id: string | null
  last_message_content: string | null
  last_message_sender_id: string | null
  last_message_at: string | null
  last_message_is_deleted: boolean | null
  unread_count: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  reply_to_id: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  sender_username?: string
  sender_display_name?: string | null
  sender_avatar_url?: string | null
  reply_to_content?: string | null
  reply_to_sender_id?: string | null
  reply_to_sender_username?: string | null
  // Client-side only
  status?: "sending" | "sent" | "failed"
  tempId?: string
  readByOther?: boolean
}
