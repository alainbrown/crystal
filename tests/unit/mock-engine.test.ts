import { describe, expect, it } from 'vitest'
import { MockEngine } from '@/worker/mock-engine'
import { DEFAULT_MODEL_ID } from '@/lib/models'

const loadOpts = { precision: 'q4', cpuFallback: false } as const

describe('MockEngine', () => {
  it('emits monotonic download progress then loads', async () => {
    const engine = new MockEngine({ stepMs: 0, chunks: 5 })
    const seen: number[] = []
    await engine.load(DEFAULT_MODEL_ID, loadOpts, {
      onProgress: (p) => seen.push(p.progress),
    })
    expect(seen).toHaveLength(5)
    expect(seen[seen.length - 1]).toBe(1)
    expect([...seen].sort((a, b) => a - b)).toEqual(seen)
  })

  it('streams reasoning then answer tokens when reasoning is on', async () => {
    const engine = new MockEngine({ stepMs: 0 })
    await engine.load(DEFAULT_MODEL_ID, loadOpts, { onProgress: () => {} })

    const kinds = new Set<string>()
    let answer = ''
    const result = await engine.generate(
      [{ role: 'user', content: 'hello there' }],
      { temperature: 0.7, maxTokens: 512, reasoning: true },
      {
        onToken: (tok, kind) => {
          kinds.add(kind)
          if (kind === 'answer') answer += tok
        },
      },
    )

    expect(kinds.has('reasoning')).toBe(true)
    expect(kinds.has('answer')).toBe(true)
    expect(answer.length).toBeGreaterThan(0)
    expect(result.answer).toContain('hello there')
    expect(result.stats.tokens).toBeGreaterThan(0)
  })

  it('omits reasoning when disabled', async () => {
    const engine = new MockEngine({ stepMs: 0 })
    await engine.load(DEFAULT_MODEL_ID, loadOpts, { onProgress: () => {} })
    const kinds = new Set<string>()
    const res = await engine.generate(
      [{ role: 'user', content: 'hi' }],
      { temperature: 0.7, maxTokens: 512, reasoning: false },
      { onToken: (_t, kind) => kinds.add(kind) },
    )
    expect(kinds.has('reasoning')).toBe(false)
    expect(res.reasoning).toBeUndefined()
  })

  it('acknowledges attached images from multimodal content parts', async () => {
    const engine = new MockEngine({ stepMs: 0 })
    await engine.load(DEFAULT_MODEL_ID, loadOpts, { onProgress: () => {} })
    const res = await engine.generate(
      [
        {
          role: 'user',
          content: [
            { type: 'image', image: 'data:a' },
            { type: 'text', text: 'describe' },
          ],
        },
      ],
      { temperature: 0.7, maxTokens: 512, reasoning: false },
      { onToken: () => {} },
    )
    expect(res.answer).toContain('1 attached image')
    expect(res.answer).toContain('describe')
  })

  it('stops early when interrupted', async () => {
    const engine = new MockEngine({ stepMs: 1 })
    await engine.load(DEFAULT_MODEL_ID, loadOpts, { onProgress: () => {} })
    const p = engine.generate(
      [{ role: 'user', content: 'a long question' }],
      { temperature: 0.7, maxTokens: 512, reasoning: false },
      { onToken: () => engine.interrupt() },
    )
    const res = await p
    expect(res.stats.tokens).toBeLessThan(5)
  })

  it('throws if generating before load', async () => {
    const engine = new MockEngine({ stepMs: 0 })
    await expect(
      engine.generate([], { temperature: 0.7, maxTokens: 512, reasoning: false }, { onToken: () => {} }),
    ).rejects.toThrow(/not loaded/i)
  })
})
