// Turn an uploaded image File into a downscaled JPEG data URL. Images travel to the
// service worker as strings over the chrome.runtime port (which is effectively JSON)
// and are persisted into chrome.storage with the conversation, so we cap the longest
// edge and re-encode as JPEG to keep both payloads small. The vision encoder runs at a
// modest internal resolution anyway, so ~1024px loses nothing the model would use.
export const MAX_IMAGE_EDGE = 1024
const JPEG_QUALITY = 0.85

export async function fileToDataURL(file: File, maxEdge = MAX_IMAGE_EDGE): Promise<string> {
  return bitmapToDataURL(await createImageBitmap(file), maxEdge)
}

/** Downscale an existing data URL (e.g. a full-resolution tab screenshot) the same way
 * uploaded files are, so captures stay within the same size/token budget. */
export async function downscaleDataUrl(dataUrl: string, maxEdge = MAX_IMAGE_EDGE): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  return bitmapToDataURL(await createImageBitmap(blob), maxEdge)
}

function bitmapToDataURL(bitmap: ImageBitmap, maxEdge: number): string {
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } finally {
    bitmap.close()
  }
}
