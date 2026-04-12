import { useState, useEffect, useRef } from "react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"
const POLL_INTERVAL_MS = 30000

export function ServerStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) })
        setStatus(res.ok ? "online" : "offline")
      } catch {
        setStatus("offline")
      }
    }

    check()
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${
          status === "checking"
            ? "bg-muted-foreground animate-pulse"
            : status === "online"
              ? "bg-green-500"
              : "bg-red-500"
        }`}
      />
      <span className="text-muted-foreground text-[11px]">
        {status === "checking" && "Checking server..."}
        {status === "online" && "Systems operational"}
        {status === "offline" && "Server unavailable"}
      </span>
    </div>
  )
}
