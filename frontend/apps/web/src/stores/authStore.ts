import { create } from "zustand"
import api from "@/lib/api"
import { connectSocket, disconnectSocket } from "@/lib/socket"
import type { AuthUser } from "@/lib/types"

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    username: string,
    password: string,
    displayName?: string
  ) => Promise<void>
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password })
    localStorage.setItem("token", data.token)
    localStorage.setItem("user", JSON.stringify(data.user))
    connectSocket(data.token)
    set({ user: data.user, token: data.token, isAuthenticated: true })
  },

  register: async (email, username, password, displayName) => {
    const { data } = await api.post("/auth/register", {
      email,
      username,
      password,
      displayName,
    })
    localStorage.setItem("token", data.token)
    localStorage.setItem("user", JSON.stringify(data.user))
    connectSocket(data.token)
    set({ user: data.user, token: data.token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    disconnectSocket()
    set({ user: null, token: null, isAuthenticated: false })
  },

  hydrate: () => {
    const token = localStorage.getItem("token")
    const userJson = localStorage.getItem("user")
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson)
        connectSocket(token)
        set({ user, token, isAuthenticated: true, isLoading: false })
      } catch {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        set({ isLoading: false })
      }
    } else {
      set({ isLoading: false })
    }
  },
}))
