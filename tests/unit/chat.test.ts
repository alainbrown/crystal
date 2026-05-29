import { describe, expect, it } from 'vitest'
import {
  cleanToken,
  splitReasoning,
  toModelMessages,
  type ChatMessage,
} from '@/lib/chat'

describe('splitReasoning', () => {
  it('returns plain answer when there is no think block', () => {
    expect(splitReasoning('just an answer')).toEqual({ answer: 'just an answer' })
  })

  it('extracts a complete think block', () => {
    const { reasoning, answer } = splitReasoning('<think>weighing options</think>Here is the reply')
    expect(reasoning).toBe('weighing options')
    expect(answer).toBe('Here is the reply')
  })

  it('treats an unclosed think block as reasoning-only (mid-stream)', () => {
    const { reasoning, answer } = splitReasoning('<think>still thinking')
    expect(reasoning).toBe('still thinking')
    expect(answer).toBe('')
  })

  it('trims leading whitespace from the answer', () => {
    expect(splitReasoning('<think>x</think>\n\n  hello').answer).toBe('hello')
  })
})

describe('cleanToken', () => {
  it('strips special end tokens', () => {
    expect(cleanToken('done<|im_end|>')).toBe('done')
    expect(cleanToken('a<|endoftext|>b')).toBe('ab')
  })
})

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
