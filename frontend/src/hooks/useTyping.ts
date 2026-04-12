import { useCallback, useRef, useEffect } from "react"
import { getSocket } from "@/lib/socket"
import { useChatStore } from "@/stores/chatStore"

const TYPING_STOP_DELAY_MS = 3000
const TYPING_CLEANUP_INTERVAL_MS = 2000

export function useTyping(conversationId: string | null) {
  const stopTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const isTypingRef = useRef(false)

  const typingUsers = useChatStore((s) =>
    conversationId ? s.typingUsers[conversationId] || [] : []
  )
  const clearTypingUser = useChatStore((s) => s.clearTypingUser)

  const emitTypingStart = useCallback(() => {
    if (!conversationId) return
    const socket = getSocket()
    if (!socket) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      socket.emit("typing_start", { conversationId })
    }

    // Reset the stop timer on each keystroke
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    stopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false
      socket.emit("typing_stop", { conversationId })
    }, TYPING_STOP_DELAY_MS)
  }, [conversationId])

  const stopTyping = useCallback(() => {
    if (!conversationId || !isTypingRef.current) return
    const socket = getSocket()
    if (!socket) return

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    isTypingRef.current = false
    socket.emit("typing_stop", { conversationId })
  }, [conversationId])

  // Cleanup expired typing indicators
  useEffect(() => {
    if (!conversationId) return

    const interval = setInterval(() => {
      const now = Date.now()
      for (const user of typingUsers) {
        if (user.expiresAt < now) {
          clearTypingUser(conversationId, user.userId)
        }
      }
    }, TYPING_CLEANUP_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [conversationId, typingUsers, clearTypingUser])

  // Stop typing on conversation change or unmount
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      if (isTypingRef.current) {
        const socket = getSocket()
        if (socket && conversationId) {
          socket.emit("typing_stop", { conversationId })
        }
        isTypingRef.current = false
      }
    }
  }, [conversationId])

  const activeTypingUsers = typingUsers.filter((t) => t.expiresAt > Date.now())

  return { emitTypingStart, stopTyping, typingUsers: activeTypingUsers }
}
