import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/users/UserAvatar"
import { MeetLinkButton } from "./MeetLinkButton"
import { ChatMoreMenu } from "./ChatMoreMenu"
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
  nudgeType?: "point" | "heart"
  onNudgeToggle?: () => void
  hasBackground?: boolean
}

export function ChatHeader({ conversation, onBack, typingUsers = [], nudgeType, onNudgeToggle, hasBackground }: ChatHeaderProps) {
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
    <div className={`flex h-14 shrink-0 items-center gap-2 border-b px-2 pt-[env(safe-area-inset-top)] md:px-4 ${hasBackground ? "bg-background/70 backdrop-blur-md" : ""}`}>
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
        <h2 className="truncate text-sm font-semibold">{name}</h2>
        <p className={`truncate text-xs ${isTyping ? "text-primary font-medium" : "text-muted-foreground"}`}>
          {statusText}
        </p>
      </div>
      <MeetLinkButton
        conversationId={conversation.id}
        savedLink={conversation.saved_link}
      />
      {nudgeType && onNudgeToggle && (
        <ChatMoreMenu
          conversationId={conversation.id}
          vanishingEnabled={conversation.vanishing_mode}
          vanishingDurationHours={conversation.vanishing_duration_hours}
          nudgeType={nudgeType}
          onNudgeToggle={onNudgeToggle}
          hasBackground={!!conversation.background_image_url}
        />
      )}
    </div>
  )
}
