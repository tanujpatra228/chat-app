import { useState } from "react"
import { Ghost } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getSocket } from "@/lib/socket"
import { useChatStore } from "@/stores/chatStore"

const DURATION_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "1 hour", value: 1 },
  { label: "6 hours", value: 6 },
  { label: "24 hours", value: 24 },
  { label: "7 days", value: 168 },
]

interface VanishingToggleProps {
  conversationId: string
  isEnabled: boolean
  durationHours: number | null
}

export function VanishingToggle({
  conversationId,
  isEnabled,
  durationHours,
}: VanishingToggleProps) {
  const [open, setOpen] = useState(false)
  const updateVanishingMode = useChatStore((s) => s.updateVanishingMode)

  function handleSelect(hours: number) {
    const socket = getSocket()
    if (!socket) return

    const vanishingMode = hours > 0

    socket.emit(
      "toggle_vanishing",
      { conversationId, vanishingMode, durationHours: hours || 24 },
      (ack: { success: boolean }) => {
        if (ack.success) {
          updateVanishingMode(conversationId, vanishingMode, vanishingMode ? hours : null)
        }
      }
    )

    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 shrink-0 ${isEnabled ? "text-amber-500" : "text-muted-foreground"}`}
        >
          <Ghost className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Vanishing messages</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          New messages will disappear after the selected time.
        </p>
        <div className="flex flex-col gap-1">
          {DURATION_OPTIONS.map((opt) => {
            const isActive =
              (opt.value === 0 && !isEnabled) ||
              (isEnabled && durationHours === opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`rounded-lg px-4 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
