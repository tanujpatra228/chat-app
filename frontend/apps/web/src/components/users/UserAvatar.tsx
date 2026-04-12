import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"

interface UserAvatarProps {
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  isOnline?: boolean
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
}

const dotSizeClasses = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
}

export function UserAvatar({
  username,
  displayName,
  avatarUrl,
  isOnline,
  size = "md",
}: UserAvatarProps) {
  const initials = (displayName || username)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="relative">
      <Avatar className={sizeClasses[size]}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      {isOnline !== undefined && (
        <span
          className={`absolute right-0 bottom-0 rounded-full border-2 border-background ${dotSizeClasses[size]} ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`}
        />
      )}
    </div>
  )
}
