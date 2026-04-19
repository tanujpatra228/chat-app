import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Send, X, ImagePlus, Loader2, Check } from "lucide-react"
import { useChatStore } from "@/stores/chatStore"
import api from "@/lib/api"
import type { Message } from "@/lib/types"

const DRAFTS_KEY = "chat-drafts"
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/heic,image/heif"

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
  onSend: (content: string, replyToId?: string, replyToContent?: string, replyToSenderUsername?: string) => void
  onTyping?: () => void
  onStopTyping?: () => void
  onUploadStart?: () => void
  onUploadProgress?: (percent: number) => void
  onUploadEnd?: () => void
  disabled?: boolean
  mode?: 'send' | 'edit'
  editingMessage?: Message | null
  onSaveEdit?: (content: string) => void
  onCancelEdit?: () => void
}

export function MessageInput({
  conversationId,
  onSend,
  onTyping,
  onStopTyping,
  onUploadStart,
  onUploadProgress,
  onUploadEnd,
  disabled,
  mode = 'send',
  editingMessage,
  onSaveEdit,
  onCancelEdit,
}: MessageInputProps) {
  const [content, setContent] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { replyTo, setReplyTo } = useChatStore()

  // Load draft on conversation change
  useEffect(() => {
    if (mode === 'send') {
      setContent(loadDraft(conversationId))
    } else if (mode === 'edit' && editingMessage) {
      setContent(editingMessage.content)
    }
  }, [conversationId, mode, editingMessage])

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

      if (mode === 'edit') {
        onSaveEdit?.(trimmed)
        setContent("")
        onCancelEdit?.()
      } else {
        onSend(trimmed, replyTo?.messageId, replyTo?.content, replyTo?.senderUsername)
        setContent("")
        saveDraft(conversationId, "")
        setReplyTo(null)
        onStopTyping?.()
        // Re-focus textarea to keep keyboard open on mobile
        requestAnimationFrame(() => textareaRef.current?.focus())
      }
    },
    [content, mode, replyTo, onSend, setReplyTo, onStopTyping, onSaveEdit, onCancelEdit, conversationId]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    onTyping?.()
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset file input so same file can be selected again
    e.target.value = ""

    setIsUploading(true)
    onUploadStart?.()
    try {
      const formData = new FormData()
      formData.append("image", file)

      await api.post(`/conversations/${conversationId}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            )
            onUploadProgress?.(percent)
          }
        },
      })
    } catch (err) {
      console.error("Image upload failed:", err)
    } finally {
      setIsUploading(false)
      onUploadEnd?.()
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
    <div className="border-t">
      {/* Reply preview */}
      {replyTo && mode === 'send' && (
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
        className="flex items-end gap-1.5 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-4 md:py-3"
      >
        {/* Image picker - hide in edit mode */}
        {mode === 'send' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              onChange={handleImageSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </Button>
          </>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'edit' ? "Edit message..." : "Type a message..."}
          disabled={disabled || isUploading}
          rows={1}
          className="bg-muted flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none placeholder:text-muted-foreground md:px-4 md:py-2.5"
        />
        {mode === 'edit' ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setContent("")
                onCancelEdit?.()
              }}
              className="h-9 px-3"
            >
              <X />
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!content.trim() || content.trim() === editingMessage?.content}
              className="h-9 px-3"
            >
              <Check />
            </Button>
          </div>
        ) : (
          <Button
            type="submit"
            size="icon"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled || isUploading || !content.trim()}
            className="h-9 w-9 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  )
}
