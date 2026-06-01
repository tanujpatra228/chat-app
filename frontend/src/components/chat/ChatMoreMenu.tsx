import { useRef, useState } from "react"
import { MoreVertical, Ghost, ImageUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getSocket } from "@/lib/socket"
import { useChatStore } from "@/stores/chatStore"
import api from "@/lib/api"

const DURATION_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "1 hour", value: 1 },
  { label: "6 hours", value: 6 },
  { label: "12 hours", value: 12 },
  { label: "24 hours", value: 24 },
  { label: "7 days", value: 168 },
]

interface ChatMoreMenuProps {
  conversationId: string
  vanishingEnabled: boolean
  vanishingDurationHours: number | null
  nudgeType: "point" | "heart"
  onNudgeToggle: () => void
  hasBackground: boolean
}

export function ChatMoreMenu({
  conversationId,
  vanishingEnabled,
  vanishingDurationHours,
  nudgeType,
  onNudgeToggle,
  hasBackground,
}: ChatMoreMenuProps) {
  const [vanishingOpen, setVanishingOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { updateVanishingMode, updateConversationBackground } = useChatStore()

  function handleVanishingSelect(hours: number) {
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
    setVanishingOpen(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setUploading(true)
    try {
      const form = new FormData()
      form.append("image", file)
      const { data } = await api.post(`/conversations/${conversationId}/background`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      updateConversationBackground(conversationId, data.background_image_url)
    } catch (err) {
      console.error("Failed to upload background:", err)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveBackground() {
    try {
      await api.delete(`/conversations/${conversationId}/background`)
      updateConversationBackground(conversationId, null)
    } catch (err) {
      console.error("Failed to remove background:", err)
    }
  }

  const vanishingLabel = vanishingEnabled
    ? DURATION_OPTIONS.find((o) => o.value === vanishingDurationHours)?.label ?? "On"
    : null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          {/* Vanishing messages */}
          <DropdownMenuItem
            onSelect={() => setVanishingOpen(true)}
            className="gap-2"
          >
            <Ghost className={`h-4 w-4 ${vanishingEnabled ? "text-amber-500" : ""}`} />
            <span>Vanishing messages</span>
            {vanishingLabel && (
              <span className="ml-auto text-xs text-amber-500">{vanishingLabel}</span>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Nudge type */}
          <DropdownMenuItem onSelect={onNudgeToggle} className="gap-2">
            <span className="text-base leading-none">
              {nudgeType === "heart" ? "♥️" : "👉"}
            </span>
            <span>Nudge: {nudgeType === "heart" ? "Heart" : "Point"}</span>
            <span className="ml-auto text-xs text-muted-foreground">tap to switch</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Background image */}
          <DropdownMenuItem
            onSelect={() => fileInputRef.current?.click()}
            className="gap-2"
            disabled={uploading}
          >
            {uploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ImageUp className={`h-4 w-4 ${hasBackground ? "text-primary" : ""}`} />
            }
            <span>{hasBackground ? "Change background" : "Set background"}</span>
          </DropdownMenuItem>

          {hasBackground && (
            <DropdownMenuItem
              onSelect={handleRemoveBackground}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <ImageUp className="h-4 w-4 opacity-0" />
              <span>Remove background</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Vanishing dialog — rendered outside dropdown to avoid nesting issues */}
      <Dialog open={vanishingOpen} onOpenChange={setVanishingOpen}>
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
                (opt.value === 0 && !vanishingEnabled) ||
                (vanishingEnabled && vanishingDurationHours === opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => handleVanishingSelect(opt.value)}
                  className={`rounded-lg px-4 py-2.5 text-left text-sm transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  )
}
