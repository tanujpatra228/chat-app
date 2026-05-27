// Insert Cloudinary transformation params before the version/path segment.
// Low-res thumbnail: 600px wide, 40% quality, auto format — blurred in CSS.
export function bgThumbnailUrl(url: string): string {
  return url.replace("/upload/", "/upload/q_40,w_600,f_auto/")
}
