import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { UserAvatar } from "@/components/users/UserAvatar"
import { formatLastSeen } from "@/utils/formatDate"
import type { Conversation } from "@/lib/types"

interface ChatHeaderProps {
  conversation: Conversation
  onBack?: () => void
}

export function ChatHeader({ conversation, onBack }: ChatHeaderProps) {
  const name = conversation.other_display_name || conversation.other_username
  const statusText = conversation.other_is_online
    ? "Online"
    : `Last seen ${formatLastSeen(conversation.other_last_seen)}`

  return (
    <div className="border-b flex h-16 shrink-0 items-center gap-3 px-4">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <UserAvatar
        username={conversation.other_username}
        displayName={conversation.other_display_name}
        avatarUrl={conversation.other_avatar_url}
        isOnline={conversation.other_is_online}
      />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold">{name}</h2>
        <p className="text-muted-foreground truncate text-xs">{statusText}</p>
      </div>
    </div>
  )
}
