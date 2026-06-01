// Insert Cloudinary transformation params before the version/path segment.
// Low-res thumbnail: 600px wide, 40% quality, auto format — blurred in CSS.
export function bgThumbnailUrl(url: string): string {
  return url.replace("/upload/", "/upload/q_40,w_600,f_auto/")
}

// Generate a poster image from a Cloudinary video URL.
// Changes the extension to .jpg and inserts a thumbnail transform.
export function videoThumbnailUrl(url: string): string {
  return url
    .replace("/upload/", "/upload/so_auto,f_jpg,w_600,q_60/")
    .replace(/\.(mp4|mov|webm|avi|mkv|m4v|ogg)$/i, ".jpg")
}
