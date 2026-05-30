// Hand-off channel for a screenshot captured in the background service worker (which
// owns the activeTab grant from a context-menu click) to the side panel's composer.
// chrome.storage.session is in-memory and MV3-friendly: it's race-free across the
// "panel was just opened by the same click" case — the panel reads any value queued
// before it mounted, and subscribes for ones that arrive while it's open.
const CAPTURE_KEY = 'crystal.pendingCapture'

/** A region selected on the page, in CSS pixels plus the page's devicePixelRatio so the
 * panel can map it onto the (physical-pixel) capture before cropping. */
export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
  dpr: number
}

export interface PendingCapture {
  url: string
  /** When set, the panel crops the capture to this region; otherwise it attaches whole. */
  rect?: CaptureRect
}

function hasSession(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.session
}

/** Background side: stash a captured screenshot (optionally a region) for the panel. */
export async function queueCapture(capture: PendingCapture): Promise<void> {
  if (hasSession()) await chrome.storage.session.set({ [CAPTURE_KEY]: capture })
}

/** Panel side: take and clear any queued capture (idempotent — returns null if none). */
export async function takePendingCapture(): Promise<PendingCapture | null> {
  if (!hasSession()) return null
  const data = await chrome.storage.session.get(CAPTURE_KEY)
  const capture = data[CAPTURE_KEY] as PendingCapture | undefined
  if (!capture || typeof capture.url !== 'string' || !capture.url) return null
  await chrome.storage.session.remove(CAPTURE_KEY)
  return capture
}

/** Panel side: fire `cb` when a capture is queued while the panel is already open. */
export function subscribePendingCapture(cb: () => void): () => void {
  if (!hasSession() || !chrome.storage.onChanged) return () => {}
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'session' && changes[CAPTURE_KEY]?.newValue) cb()
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}
