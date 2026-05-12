import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"
import { useChatStore } from "@/stores/chatStore"

interface MeetLinkButtonProps {
  conversationId: string
  savedLink: string | null
}

const DOUBLE_CLICK_MS = 300

// Google Meet icon SVG
function MeetIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M21 8.5v7l-3-2.5V11l3-2.5zM3 7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"
        fill="currentColor"
      />
    </svg>
  )
}

export function MeetLinkButton({ conversationId, savedLink }: MeetLinkButtonProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [saving, setSaving] = useState(false)
  const lastClickRef = useRef(0)
  const updateConversationSavedLink = useChatStore((s) => s.updateConversationSavedLink)

  useEffect(() => {
    if (modalOpen) setUrlInput(savedLink || "")
  }, [modalOpen, savedLink])

  function handleClick() {
    const now = Date.now()
    if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
      // Double click → open edit modal
      lastClickRef.current = 0
      setModalOpen(true)
    } else {
      lastClickRef.current = now
      // Single click — wait to see if double follows
      setTimeout(() => {
        if (lastClickRef.current === now) {
          // Still single → open link or modal if none set
          if (savedLink) {
            window.open(savedLink, "_blank", "noopener,noreferrer")
          } else {
            setModalOpen(true)
          }
        }
      }, DOUBLE_CLICK_MS + 10)
    }
  }

  async function handleSave() {
    const trimmed = urlInput.trim()
    setSaving(true)
    try {
      await api.patch(`/conversations/${conversationId}/saved-link`, {
        url: trimmed || null,
      })
      updateConversationSavedLink(conversationId, trimmed || null)
      setModalOpen(false)
    } catch (err) {
      console.error("Failed to save link:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 shrink-0 ${savedLink ? "text-green-500" : "text-muted-foreground"}`}
        onClick={handleClick}
        title={savedLink ? `Open: ${savedLink}` : "Set meeting link"}
      >
        <MeetIcon className="h-4 w-4" />
      </Button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Meeting link</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meet-url">URL</Label>
              <Input
                id="meet-url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://meet.google.com/xxx-yyyy-zzz"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave()
                  if (e.key === "Escape") setModalOpen(false)
                }}
              />
            </div>
            <div className="flex justify-between gap-2">
              {savedLink && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { setUrlInput(""); handleSave() }}
                >
                  Remove
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
