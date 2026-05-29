import { describe, expect, it } from 'vitest'
import { toModelMessages, type ChatMessage } from '@/lib/chat'

describe('toModelMessages', () => {
  it('drops ui-only fields and keeps role/content', () => {
    const msgs: ChatMessage[] = [
      { id: '1', role: 'user', content: 'hi', createdAt: 0 },
      { id: '2', role: 'assistant', content: 'hello', reasoning: 'secret', streaming: false, createdAt: 1 },
    ]
    expect(toModelMessages(msgs)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])
  })

  it('drops empty user messages', () => {
    const msgs: ChatMessage[] = [{ id: '1', role: 'user', content: '   ', createdAt: 0 }]
    expect(toModelMessages(msgs)).toEqual([])
  })
})
