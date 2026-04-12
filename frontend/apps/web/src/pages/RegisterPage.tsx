import { Navigate } from "react-router"
import { RegisterForm } from "@/components/auth/RegisterForm"
import { useAuthStore } from "@/stores/authStore"

export function RegisterPage() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/chat" replace />

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <RegisterForm />
    </div>
  )
}
