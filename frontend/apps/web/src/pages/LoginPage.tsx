import { Navigate } from "react-router"
import { LoginForm } from "@/components/auth/LoginForm"
import { useAuthStore } from "@/stores/authStore"

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/chat" replace />

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <LoginForm />
    </div>
  )
}
