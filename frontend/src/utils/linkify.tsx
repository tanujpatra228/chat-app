import { ExternalLink } from "lucide-react"

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi

function shortLabel(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")
    const path = u.pathname === "/" ? "" : u.pathname
    const full = host + path
    return full.length > 32 ? full.slice(0, 30) + "…" : full
  } catch {
    return url.length > 32 ? url.slice(0, 30) + "…" : url
  }
}

export function linkifyText(text: string, isMine = false): React.ReactNode[] {
  if (!text) return []
  const parts = text.split(URL_REGEX)

  const chipClass = isMine
    ? "bg-white/25 text-white hover:bg-white/40"
    : "bg-black/10 text-foreground hover:bg-black/15"

  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          title={part}
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 mx-0.5 align-middle text-xs font-medium transition-colors ${chipClass}`}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{shortLabel(part)}</span>
        </a>
      )
    }
    URL_REGEX.lastIndex = 0
    return <span key={i}>{part}</span>
  })
}
