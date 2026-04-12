import { useState, useEffect, useRef } from "react"
import { Input } from "@workspace/ui/components/input"
import { UserAvatar } from "./UserAvatar"
import api from "@/lib/api"
import type { User } from "@/lib/types"

interface UserSearchProps {
  onSelect: (user: User) => void
}

export function UserSearch({ onSelect }: UserSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 1) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const { data } = await api.get("/users/search", {
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
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username..."
        autoFocus
      />
      {isSearching && (
        <p className="text-muted-foreground px-2 text-sm">Searching...</p>
      )}
      {results.length > 0 && (
        <div className="flex flex-col">
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelect(user)}
              className="hover:bg-accent flex items-center gap-3 rounded-md px-2 py-2 text-left"
            >
              <UserAvatar
                username={user.username}
                displayName={user.displayName}
                avatarUrl={user.avatarUrl}
                isOnline={user.isOnline}
                size="sm"
              />
              <div>
                <p className="text-sm font-medium">
                  {user.displayName || user.username}
                </p>
                <p className="text-muted-foreground text-xs">@{user.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {!isSearching && query.trim().length >= 1 && results.length === 0 && (
        <p className="text-muted-foreground px-2 text-sm">No users found</p>
      )}
    </div>
  )
}
