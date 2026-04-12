import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router"
import { ConversationList } from "@/components/chat/ConversationList"
import { MessageThread } from "@/components/chat/MessageThread"
import { MessageSearch } from "@/components/chat/MessageSearch"
import { EmptyState } from "@/components/chat/EmptyState"
import { useConversations } from "@/hooks/useConversations"
import { useSocket } from "@/hooks/useSocket"
import { useChatStore } from "@/stores/chatStore"

export function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { conversations, refetch } = useConversations()
  const { activeConversationId, setActiveConversation } = useChatStore()
  const [showSearch, setShowSearch] = useState(false)

  useSocket()

  useEffect(() => {
    setActiveConversation(id || null)
  }, [id, setActiveConversation])

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  )

  function handleSelectConversation(conversationId: string) {
    setShowSearch(false)
    navigate(`/chat/${conversationId}`)
  }

  function handleBack() {
    navigate("/chat")
  }

  const hasActive = !!activeConversationId

  return (
    <div className="fixed inset-0 flex">
      {/* Conversation list — full screen on mobile, fixed sidebar on desktop */}
      <div
        className={`absolute inset-0 flex flex-col md:relative md:inset-auto md:w-80 md:shrink-0 ${
          hasActive || showSearch ? "pointer-events-none hidden md:pointer-events-auto md:flex" : ""
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onConversationCreated={refetch}
          onOpenSearch={() => setShowSearch(true)}
        />
      </div>

      {/* Search panel — replaces thread on mobile, overlay on desktop */}
      {showSearch && (
        <div className="absolute inset-0 flex flex-col md:relative md:inset-auto md:flex-1">
          <MessageSearch
            onSelectResult={handleSelectConversation}
            onClose={() => setShowSearch(false)}
          />
        </div>
      )}

      {/* Message thread — full screen on mobile, flex panel on desktop */}
      {!showSearch && (
        <div
          className={`absolute inset-0 flex flex-col md:relative md:inset-auto md:flex-1 ${
            hasActive ? "" : "pointer-events-none hidden md:pointer-events-auto md:flex"
          }`}
        >
          {activeConversation ? (
            <MessageThread
              conversation={activeConversation}
              onBack={handleBack}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      )}
    </div>
  )
}
