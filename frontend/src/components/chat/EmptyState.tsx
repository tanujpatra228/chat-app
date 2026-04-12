import { MessageSquare } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <MessageSquare className="text-muted-foreground/50 h-12 w-12" />
      <div className="text-center">
        <h3 className="font-medium">No conversation selected</h3>
        <p className="text-muted-foreground text-sm">
          Choose a conversation from the sidebar or start a new one
        </p>
      </div>
    </div>
  )
}
