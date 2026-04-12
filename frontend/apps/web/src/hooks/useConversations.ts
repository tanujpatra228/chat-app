import { useEffect, useCallback } from "react"
import api from "@/lib/api"
import { useChatStore } from "@/stores/chatStore"

export function useConversations() {
  const { conversations, setConversations } = useChatStore()

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/conversations")
      setConversations(data)
    } catch (err) {
      console.error("Failed to fetch conversations:", err)
    }
  }, [setConversations])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  return { conversations, refetch: fetchConversations }
}
