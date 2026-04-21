interface LinkPreviewProps {
  url: string
  title?: string | null
  description?: string | null
  image?: string | null
  isMine: boolean
}

export function LinkPreview({ url, title, description, image, isMine }: LinkPreviewProps) {
  let hostname = ""
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "")
  } catch {
    hostname = url
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-1 flex overflow-hidden rounded-lg border transition-colors hover:opacity-90 ${
        isMine ? "bg-primary/10 border-primary/20" : "bg-background border-border"
      }`}
    >
      {image && (
        <div className="w-20 shrink-0 bg-muted">
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex min-w-0 flex-col justify-center gap-0.5 p-2">
        {title && (
          <p className="truncate text-xs font-semibold">{title}</p>
        )}
        {description && (
          <p className="line-clamp-2 text-[11px] opacity-80">{description}</p>
        )}
        <p className="truncate text-[10px] opacity-60">{hostname}</p>
      </div>
    </a>
  )
}
