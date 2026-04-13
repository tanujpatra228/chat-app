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
    <div className="relative flex h-[100dvh] w-full overflow-hidden">
      {/* Conversation list — full screen on mobile, fixed sidebar on desktop */}
      <div
        className={`h-full w-full shrink-0 flex-col md:flex md:w-80 ${
          hasActive || showSearch ? "hidden md:flex" : "flex"
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
        <div className="flex h-full w-full flex-col md:flex-1">
          <MessageSearch
            onSelectResult={handleSelectConversation}
            onClose={() => setShowSearch(false)}
          />
        </div>
      )}

      {/* Message thread — full screen on mobile, flex panel on desktop */}
      {!showSearch && (
        <div
          className={`h-full w-full min-w-0 flex-col md:flex md:flex-1 ${
            hasActive ? "flex" : "hidden md:flex"
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
