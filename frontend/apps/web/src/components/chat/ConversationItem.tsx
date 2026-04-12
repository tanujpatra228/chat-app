import { UserAvatar } from "@/components/users/UserAvatar"
import { Badge } from "@workspace/ui/components/badge"
import { formatMessageTime } from "@/utils/formatDate"
import type { Conversation } from "@/lib/types"

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const name =
    conversation.other_display_name || conversation.other_username

  const lastMessagePreview = conversation.last_message_is_deleted
    ? "Message deleted"
    : conversation.last_message_content

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
        isActive ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <UserAvatar
        username={conversation.other_username}
        displayName={conversation.other_display_name}
        avatarUrl={conversation.other_avatar_url}
        isOnline={conversation.other_is_online}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium">{name}</span>
          {conversation.last_message_at && (
            <span className="text-muted-foreground shrink-0 text-[10px]">
              {formatMessageTime(conversation.last_message_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground truncate text-xs">
            {lastMessagePreview || "No messages yet"}
          </p>
          {conversation.unread_count > 0 && (
            <Badge variant="default" className="ml-2 h-5 min-w-5 shrink-0 justify-center rounded-full px-1.5 text-[10px]">
              {conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}
