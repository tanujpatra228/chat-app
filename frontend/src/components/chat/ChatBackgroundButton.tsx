import { useRef, useCallback, useState } from "react"
import { ImageUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { useChatStore } from "@/stores/chatStore"

interface ChatBackgroundButtonProps {
  conversationId: string
  hasBackground: boolean
}

const LONG_PRESS_MS = 500

export function ChatBackgroundButton({ conversationId, hasBackground }: ChatBackgroundButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const [uploading, setUploading] = useState(false)
  const updateConversationBackground = useChatStore((s) => s.updateConversationBackground)

  const handleTouchStart = useCallback(() => {
    if (!hasBackground) return
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30)
      handleRemove()
    }, LONG_PRESS_MS)
  }, [hasBackground])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  function handleClick() {
    fileInputRef.current?.click()
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

  async function handleRemove() {
    try {
      await api.delete(`/conversations/${conversationId}/background`)
      updateConversationBackground(conversationId, null)
    } catch (err) {
      console.error("Failed to remove background:", err)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 shrink-0 ${hasBackground ? "text-primary" : "text-muted-foreground"}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        disabled={uploading}
        title={hasBackground ? "Change background (long-press to remove)" : "Set chat background"}
      >
        {uploading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <ImageUp className="h-4 w-4" />
        }
      </Button>
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
