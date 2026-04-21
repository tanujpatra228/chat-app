const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi

export function linkifyText(text: string): React.ReactNode[] {
  if (!text) return []
  const parts = text.split(URL_REGEX)

  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // Reset regex state (g flag keeps lastIndex)
      URL_REGEX.lastIndex = 0
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline underline-offset-2 break-all hover:opacity-80"
        >
          {part}
        </a>
      )
    }
    URL_REGEX.lastIndex = 0
    return <span key={i}>{part}</span>
  })
}
