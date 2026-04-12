import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

interface ImageLightboxProps {
  src: string
  onClose: () => void
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  // Prevent body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/90"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        style={{ zIndex: 10000 }}
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt="Full size"
        className="max-h-[90dvh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}
