import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/users/UserAvatar"
import { VanishingToggle } from "./VanishingToggle"
import { formatLastSeen } from "@/utils/formatDate"
import type { Conversation } from "@/lib/types"

interface TypingUser {
  userId: string
  username: string
}

interface ChatHeaderProps {
  conversation: Conversation
  onBack?: () => void
  typingUsers?: TypingUser[]
}

export function ChatHeader({ conversation, onBack, typingUsers = [] }: ChatHeaderProps) {
  const name = conversation.other_display_name || conversation.other_username

  let statusText: string
  let isTyping = false

  if (typingUsers.length > 0) {
    statusText = "typing..."
    isTyping = true
  } else if (conversation.other_is_online) {
    statusText = "Online"
  } else {
    statusText = `Last seen ${formatLastSeen(conversation.other_last_seen)}`
  }

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b px-2 pt-[env(safe-area-inset-top)] md:px-4">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <UserAvatar
        username={conversation.other_username}
        displayName={conversation.other_display_name}
        avatarUrl={conversation.other_avatar_url}
        isOnline={conversation.other_is_online}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h2 className="truncate text-sm font-semibold">{name}</h2>
          {conversation.vanishing_mode && (
            <span className="text-amber-500 text-[10px]" title="Vanishing messages on">
              &#9760;
            </span>
          )}
        </div>
        <p className={`truncate text-xs ${isTyping ? "text-primary font-medium" : "text-muted-foreground"}`}>
          {statusText}
        </p>
      </div>
      <VanishingToggle
        conversationId={conversation.id}
        isEnabled={conversation.vanishing_mode}
        durationHours={conversation.vanishing_duration_hours}
      />
    </div>
  )
}
