import { afterEach, describe, expect, it, vi } from 'vitest'
import { queueDrop, subscribePendingDrop, takePendingDrop } from '@/lib/capture'

type Listener = (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  area: string,
) => void

function installSession() {
  const store = new Map<string, unknown>()
  const listeners = new Set<Listener>()
  vi.stubGlobal('chrome', {
    storage: {
      session: {
        get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          for (const [k, newValue] of Object.entries(obj)) {
            const oldValue = store.get(k)
            store.set(k, newValue)
            for (const l of listeners) l({ [k]: { newValue, oldValue } }, 'session')
          }
        }),
        remove: vi.fn(async (key: string) => void store.delete(key)),
      },
      onChanged: {
        addListener: (cb: Listener) => listeners.add(cb),
        removeListener: (cb: Listener) => listeners.delete(cb),
      },
    },
  })
}

describe('capture handoff (chrome.storage.session)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips an image drop (with region) and clears it after taking', async () => {
    installSession()
    const drop = { kind: 'image', url: 'data:img', rect: { x: 1, y: 2, width: 3, height: 4, dpr: 2 } } as const
    await queueDrop(drop)
    expect(await takePendingDrop()).toEqual(drop)
    expect(await takePendingDrop()).toBeNull() // idempotent — cleared on take
  })

  it('round-trips a page-text drop', async () => {
    installSession()
    await queueDrop({ kind: 'pageText', title: 'T', url: 'https://x.test', text: 'body' })
    expect(await takePendingDrop()).toMatchObject({ kind: 'pageText', text: 'body' })
  })

  it('notifies subscribers on queue, and stops after unsubscribe', async () => {
    installSession()
    const cb = vi.fn()
    const unsubscribe = subscribePendingDrop(cb)
    await queueDrop({ kind: 'image', url: 'data:a' })
    expect(cb).toHaveBeenCalledTimes(1)
    unsubscribe()
    await queueDrop({ kind: 'image', url: 'data:b' })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('no-ops without chrome.storage.session', async () => {
    await expect(queueDrop({ kind: 'image', url: 'x' })).resolves.toBeUndefined()
    expect(await takePendingDrop()).toBeNull()
    expect(subscribePendingDrop(() => {})()).toBeUndefined() // returns a no-op unsubscribe
  })
})
