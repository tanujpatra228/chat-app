import { useState, useRef, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import api from "@/lib/api"
import { formatMessageTime } from "@/utils/formatDate"
import type { SearchResult } from "@/lib/types"

interface MessageSearchProps {
  onSelectResult: (conversationId: string) => void
  onClose: () => void
}

export function MessageSearch({ onSelectResult, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const { data } = await api.get("/conversations/search/messages", {
          params: { q: query.trim() },
        })
        setResults(data)
      } catch (err) {
        console.error("Search failed:", err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages..."
          className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {isSearching && (
          <p className="text-muted-foreground px-4 py-4 text-center text-sm">
            Searching...
          </p>
        )}

        {!isSearching && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            No messages found
          </p>
        )}

        {results.map((result) => (
          <button
            key={result.id}
            onClick={() => onSelectResult(result.conversation_id)}
            className="flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-accent/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{result.sender_username}</span>
              <span className="text-muted-foreground text-[10px]">
                {formatMessageTime(result.created_at)}
              </span>
            </div>
            <p
              className="text-muted-foreground line-clamp-2 text-sm"
              dangerouslySetInnerHTML={{
                __html: result.headline
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/&lt;&lt;/g, '<mark class="bg-primary/20 text-foreground rounded px-0.5">')
                  .replace(/&gt;&gt;/g, "</mark>"),
              }}
            />
          </button>
        ))}
      </ScrollArea>
    </div>
  )
}
