import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Send } from "lucide-react"

interface MessageInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    onSend(trimmed)
    setContent("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [content])

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-4 md:py-3"
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        rows={1}
        className="bg-muted flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none placeholder:text-muted-foreground md:px-4 md:py-2.5"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !content.trim()}
        className="h-9 w-9 shrink-0 rounded-full"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  )
}
