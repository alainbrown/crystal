import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadConversations,
  normalizeList,
  removeConversation,
  saveConversation,
  __testing,
} from '@/lib/conversations'
import type { Conversation } from '@/lib/chat'
import { DEFAULT_MODEL_ID } from '@/lib/models'

beforeEach(() => __testing.resetMemory())

function conv(id: string, updatedAt: number, text = 'hi'): Conversation {
  return {
    id,
    title: text,
    messages: [{ id: `m_${id}`, role: 'user', content: text, createdAt: updatedAt }],
    modelId: DEFAULT_MODEL_ID,
    createdAt: updatedAt,
    updatedAt,
  }
}

describe('normalizeList', () => {
  it('drops junk and entries with no valid messages', () => {
    expect(normalizeList(null)).toEqual([])
    expect(normalizeList('nope')).toEqual([])
    expect(normalizeList([{ id: 'a', messages: [] }])).toEqual([])
    expect(normalizeList([{ id: 'a', messages: [{ role: 'bogus', content: 'x' }] }])).toEqual([])
    expect(normalizeList([{ messages: [{ role: 'user', content: 'x' }] }])).toEqual([]) // no id
  })

  it('coerces an unknown modelId to the default and fills a missing title', () => {
    const [c] = normalizeList([
      { id: 'a', messages: [{ role: 'user', content: 'x', createdAt: 1 }], modelId: 'evil/model' },
    ])
    expect(c.modelId).toBe(DEFAULT_MODEL_ID)
    expect(c.title).toBe('New chat')
  })

  it('sorts newest-first and caps at MAX_CONVERSATIONS', () => {
    const many = Array.from({ length: __testing.MAX_CONVERSATIONS + 10 }, (_, i) =>
      conv(`c${i}`, i),
    )
    const out = normalizeList(many)
    expect(out).toHaveLength(__testing.MAX_CONVERSATIONS)
    expect(out[0].updatedAt).toBeGreaterThan(out[1].updatedAt) // newest first
  })
})

describe('save/load/remove (in-memory fallback)', () => {
  it('round-trips and orders newest-first', async () => {
    await saveConversation(conv('a', 100))
    await saveConversation(conv('b', 200))
    const list = await loadConversations()
    expect(list.map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('upserts by id instead of duplicating', async () => {
    await saveConversation(conv('a', 100, 'first'))
    await saveConversation(conv('a', 300, 'edited'))
    const list = await loadConversations()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'a', updatedAt: 300, title: 'edited' })
  })

  it('removes by id', async () => {
    await saveConversation(conv('a', 100))
    await saveConversation(conv('b', 200))
    const after = await removeConversation('a')
    expect(after.map((c) => c.id)).toEqual(['b'])
    expect((await loadConversations()).map((c) => c.id)).toEqual(['b'])
  })
})
