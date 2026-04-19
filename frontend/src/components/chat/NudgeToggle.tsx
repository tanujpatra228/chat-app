import { Button } from "@/components/ui/button"

interface NudgeToggleProps {
  nudgeType: "point" | "heart"
  onToggle: () => void
}

export function NudgeToggle({ nudgeType, onToggle }: NudgeToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="h-9 w-9 shrink-0"
      title={`Current nudge: ${nudgeType === "heart" ? "Heart" : "Point"}`}
    >
      <span className="text-lg">{nudgeType === "heart" ? "♥️" : "👉"}</span>
    </Button>
  )
}