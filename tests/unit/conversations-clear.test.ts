import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearConversations,
  loadConversations,
  saveConversation,
  subscribeConversations,
  __testing,
} from '@/lib/conversations'
import type { Conversation } from '@/lib/chat'
import { DEFAULT_MODEL_ID } from '@/lib/models'

// The clear-history bug was a wrong storage key, and the fix promises the side panel's
// list updates live via storage.onChanged. The in-memory fallback can't show either, so
// these tests run the real chrome.storage path against a minimal mock.

type ChangeListener = (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  area: string,
) => void

function installChromeStorageMock() {
  const store = new Map<string, unknown>()
  const listeners = new Set<ChangeListener>()
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          for (const [k, newValue] of Object.entries(obj)) {
            const oldValue = store.get(k)
            store.set(k, newValue)
            for (const l of listeners) l({ [k]: { newValue, oldValue } }, 'local')
          }
        }),
        remove: vi.fn(async (k: string) => void store.delete(k)),
      },
      onChanged: {
        addListener: (cb: ChangeListener) => listeners.add(cb),
        removeListener: (cb: ChangeListener) => listeners.delete(cb),
      },
    },
  })
  return store
}

function conv(id: string): Conversation {
  return {
    id,
    title: 't',
    messages: [{ id: `m_${id}`, role: 'user', content: 'hi', createdAt: 1 }],
    modelId: DEFAULT_MODEL_ID,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('clearConversations (chrome.storage path)', () => {
  let store: Map<string, unknown>
  beforeEach(() => {
    store = installChromeStorageMock()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('clears under the conversations key (the one the bug got wrong)', async () => {
    expect(__testing.STORAGE_KEY).toBe('crystal.conversations')
    await saveConversation(conv('a'))
    await saveConversation(conv('b'))

    await clearConversations()

    expect(store.get('crystal.conversations')).toEqual([])
    expect(await loadConversations()).toEqual([])
  })

  it('notifies subscribers so the history drawer empties live', async () => {
    const seen: Conversation[][] = []
    const unsubscribe = subscribeConversations((list) => seen.push(list))

    await saveConversation(conv('a'))
    await clearConversations()
    unsubscribe()

    expect(seen.at(-1)).toEqual([]) // last emission reflects the cleared list
  })
})
