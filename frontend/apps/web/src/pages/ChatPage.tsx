import { useEffect } from "react"
import { useParams, useNavigate } from "react-router"
import { ConversationList } from "@/components/chat/ConversationList"
import { MessageThread } from "@/components/chat/MessageThread"
import { EmptyState } from "@/components/chat/EmptyState"
import { useConversations } from "@/hooks/useConversations"
import { useSocket } from "@/hooks/useSocket"
import { useChatStore } from "@/stores/chatStore"

export function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { conversations, refetch } = useConversations()
  const { activeConversationId, setActiveConversation } = useChatStore()

  // Register socket event listeners
  useSocket()

  // Sync URL param with store
  useEffect(() => {
    setActiveConversation(id || null)
  }, [id, setActiveConversation])

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  )

  function handleSelectConversation(conversationId: string) {
    navigate(`/chat/${conversationId}`)
  }

  function handleBack() {
    navigate("/chat")
  }

  return (
    <div className="flex h-svh">
      {/* Sidebar — hidden on mobile when conversation is active */}
      <div
        className={`w-full shrink-0 md:w-80 ${
          activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onConversationCreated={refetch}
        />
      </div>

      {/* Thread — hidden on mobile when no conversation is active */}
      <div
        className={`flex-1 ${
          activeConversationId ? "flex" : "hidden md:flex"
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
    </div>
  )
}
