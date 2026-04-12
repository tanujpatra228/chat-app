import { Navigate } from "react-router"
import { RegisterForm } from "@/components/auth/RegisterForm"
import { ServerStatus } from "@/components/auth/ServerStatus"
import { useAuthStore } from "@/stores/authStore"

export function RegisterPage() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/chat" replace />

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-8">
      <RegisterForm />
      <div className="mt-4">
        <ServerStatus />
      </div>
    </div>
  )
}
