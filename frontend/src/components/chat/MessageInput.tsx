import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Send, X } from "lucide-react"
import { useChatStore } from "@/stores/chatStore"

const DRAFTS_KEY = "chat-drafts"

function loadDraft(conversationId: string): string {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}")
    return drafts[conversationId] || ""
  } catch {
    return ""
  }
}

function saveDraft(conversationId: string, content: string) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}")
    if (content) {
      drafts[conversationId] = content
    } else {
      delete drafts[conversationId]
    }
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
  } catch {
    // ignore
  }
}

interface MessageInputProps {
  conversationId: string
  onSend: (content: string, replyToId?: string) => void
  onTyping?: () => void
  onStopTyping?: () => void
  disabled?: boolean
}

export function MessageInput({
  conversationId,
  onSend,
  onTyping,
  onStopTyping,
  disabled,
}: MessageInputProps) {
  const [content, setContent] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { replyTo, setReplyTo } = useChatStore()

  // Load draft on conversation change
  useEffect(() => {
    setContent(loadDraft(conversationId))
  }, [conversationId])

  // Save draft on content change (debounced via conversation switch)
  const saveDraftRef = useRef(content)
  saveDraftRef.current = content
  useEffect(() => {
    return () => {
      saveDraft(conversationId, saveDraftRef.current)
    }
  }, [conversationId])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = content.trim()
      if (!trimmed) return
      onSend(trimmed, replyTo?.messageId)
      setContent("")
      saveDraft(conversationId, "")
      setReplyTo(null)
      onStopTyping?.()
    },
    [content, conversationId, replyTo, onSend, setReplyTo, onStopTyping]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    onTyping?.()
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
    <div className="border-t">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 md:px-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary">
              Replying to {replyTo.senderUsername}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {replyTo.content}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setReplyTo(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-4 md:py-3"
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
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
    </div>
  )
}
