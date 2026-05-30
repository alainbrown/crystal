import { describe, expect, it } from 'vitest'
import { MAX_CONTEXT_CHARS, toModelMessages, toPageContext, userMessage, type ChatMessage } from '@/lib/chat'

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
    expect(userMessage('hi', { images: ['data:a'] }, 5)).toEqual({
      id: expect.any(String),
      role: 'user',
      content: 'hi',
      images: ['data:a'],
      createdAt: 5,
    })
    expect(userMessage('hi', {}, 5).images).toBeUndefined()
    expect(userMessage('hi', { images: [] }, 5).images).toBeUndefined()
  })
})

describe('page context', () => {
  it('truncates extracted text to the budget and counts words', () => {
    const long = 'word '.repeat(MAX_CONTEXT_CHARS) // far over the cap
    const ctx = toPageContext({ title: 'Big', url: 'https://x.test', text: long })
    expect(ctx.truncated).toBe(true)
    expect(ctx.text.length).toBe(MAX_CONTEXT_CHARS)
    expect(ctx.words).toBeGreaterThan(0)

    const small = toPageContext({ title: '', url: 'https://x.test/p', text: 'hello world' })
    expect(small.truncated).toBe(false)
    expect(small.title).toBe('https://x.test/p') // falls back to url when title empty
    expect(small.words).toBe(2)
  })

  it('prepends page context before the user text in the model message', () => {
    const msgs: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'summarize',
        contexts: [{ title: 'Doc', url: 'https://x.test', text: 'the body', words: 2, truncated: false }],
        createdAt: 0,
      },
    ]
    const [model] = toModelMessages(msgs)
    expect(model.content).toBe(
      '<page_context title="Doc" url="https://x.test">\nthe body\n</page_context>\n\nsummarize',
    )
  })

  it('keeps a context-only message (no text or images)', () => {
    const msgs: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: '',
        contexts: [{ title: 'Doc', url: 'u', text: 'body', words: 1, truncated: false }],
        createdAt: 0,
      },
    ]
    expect(toModelMessages(msgs)).toHaveLength(1)
  })
})
