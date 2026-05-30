// Hand-off channel from the background service worker (which owns the activeTab grant
// from a context-menu click) to the side panel's composer. chrome.storage.session is
// in-memory and MV3-friendly: it's race-free across the "panel was just opened by the
// same click" case — the panel reads any drop queued before it mounted, and subscribes
// for ones that arrive while it's open. One drop is a screenshot (optionally a region)
// or extracted page text.
const DROP_KEY = 'crystal.pendingDrop'

/** A region selected on the page, in CSS pixels plus the page's devicePixelRatio so the
 * panel can map it onto the (physical-pixel) capture before cropping. */
export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
  dpr: number
}

export type PendingDrop =
  | { kind: 'image'; url: string; rect?: CaptureRect }
  | { kind: 'pageText'; title: string; url: string; text: string }

function hasSession(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.session
}

/** Background side: stash a drop for the panel to pick up. */
export async function queueDrop(drop: PendingDrop): Promise<void> {
  if (hasSession()) await chrome.storage.session.set({ [DROP_KEY]: drop })
}

/** Panel side: take and clear any queued drop (idempotent — returns null if none). */
export async function takePendingDrop(): Promise<PendingDrop | null> {
  if (!hasSession()) return null
  const data = await chrome.storage.session.get(DROP_KEY)
  const drop = data[DROP_KEY] as PendingDrop | undefined
  if (!drop || typeof drop.kind !== 'string') return null
  await chrome.storage.session.remove(DROP_KEY)
  return drop
}

/** Panel side: fire `cb` when a drop is queued while the panel is already open. */
export function subscribePendingDrop(cb: () => void): () => void {
  if (!hasSession() || !chrome.storage.onChanged) return () => {}
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'session' && changes[DROP_KEY]?.newValue) cb()
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}
