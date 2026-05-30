import { describe, expect, it } from 'vitest'
import { toModelMessages, userMessage, type ChatMessage } from '@/lib/chat'

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

  it('flattens attached images into ordered image-then-text content parts', () => {
    const msgs: ChatMessage[] = [
      { id: '1', role: 'user', content: 'what is this?', images: ['data:a', 'data:b'], createdAt: 0 },
    ]
    expect(toModelMessages(msgs)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'image', image: 'data:a' },
          { type: 'image', image: 'data:b' },
          { type: 'text', text: 'what is this?' },
        ],
      },
    ])
  })

  it('keeps an image-only message (no text) instead of dropping it', () => {
    const msgs: ChatMessage[] = [{ id: '1', role: 'user', content: '', images: ['data:a'], createdAt: 0 }]
    expect(toModelMessages(msgs)).toEqual([
      { role: 'user', content: [{ type: 'image', image: 'data:a' }] },
    ])
  })
})

describe('userMessage', () => {
  it('stores images when given and omits the field otherwise', () => {
    expect(userMessage('hi', ['data:a'], 5)).toEqual({
      id: expect.any(String),
      role: 'user',
      content: 'hi',
      images: ['data:a'],
      createdAt: 5,
    })
    expect(userMessage('hi', [], 5).images).toBeUndefined()
  })
})
