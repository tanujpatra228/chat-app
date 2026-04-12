import { useState } from "react"
import { Plus, LogOut, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ConversationItem } from "./ConversationItem"
import { UserSearch } from "@/components/users/UserSearch"
import { useAuthStore } from "@/stores/authStore"
import { getSocket } from "@/lib/socket"
import api from "@/lib/api"
import type { Conversation, User } from "@/lib/types"

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onConversationCreated: () => void
  onOpenSearch?: () => void
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onConversationCreated,
  onOpenSearch,
}: ConversationListProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const { user, logout } = useAuthStore()

  const filtered = conversations.filter((c) => {
    const name = (c.other_display_name || c.other_username).toLowerCase()
    return name.includes(search.toLowerCase())
  })

  async function handleUserSelect(selectedUser: User) {
    try {
      const { data } = await api.post("/conversations", {
        participantId: selectedUser.id,
      })
      setDialogOpen(false)

      const socket = getSocket()
      if (socket) {
        socket.emit("join_conversation", data.id)
      }

      onConversationCreated()
      onSelect(data.id)
    } catch (err) {
      console.error("Failed to create conversation:", err)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background md:border-r">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 pt-[env(safe-area-inset-top)]">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight">Chats</h1>
          <p className="text-muted-foreground truncate text-xs">
            @{user?.username}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {onOpenSearch && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenSearch}>
              <Search className="h-4 w-4" />
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New conversation</DialogTitle>
              </DialogHeader>
              <UserSearch onSelect={handleUserSelect} />
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="h-9"
        />
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-col gap-0.5 px-2">
          {filtered.length === 0 && (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              {conversations.length === 0
                ? "No conversations yet"
                : "No matching conversations"}
            </p>
          )}
          {filtered.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
