// Hand-off channel for a screenshot captured in the background service worker (which
// owns the activeTab grant from a context-menu click) to the side panel's composer.
// chrome.storage.session is in-memory and MV3-friendly: it's race-free across the
// "panel was just opened by the same click" case — the panel reads any value queued
// before it mounted, and subscribes for ones that arrive while it's open.
const CAPTURE_KEY = 'crystal.pendingCapture'

function hasSession(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.session
}

/** Background side: stash a captured screenshot data URL for the panel to pick up. */
export async function queueCapture(dataUrl: string): Promise<void> {
  if (hasSession()) await chrome.storage.session.set({ [CAPTURE_KEY]: dataUrl })
}

/** Panel side: take and clear any queued capture (idempotent — returns null if none). */
export async function takePendingCapture(): Promise<string | null> {
  if (!hasSession()) return null
  const data = await chrome.storage.session.get(CAPTURE_KEY)
  const url = data[CAPTURE_KEY]
  if (typeof url !== 'string' || !url) return null
  await chrome.storage.session.remove(CAPTURE_KEY)
  return url
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
