import { io, Socket } from "socket.io-client"

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  })

  socket.on("connect", () => {
    console.log("Socket connected")
  })

  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message)
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
