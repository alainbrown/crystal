import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalize,
  saveSettings,
  __testing,
} from '@/lib/settings'

beforeEach(() => __testing.resetMemory())

describe('normalize', () => {
  it('falls back to defaults for junk input', () => {
    expect(normalize(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalize('nope')).toEqual(DEFAULT_SETTINGS)
    expect(normalize({ unknown: 1 })).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps numeric ranges', () => {
    expect(normalize({ temperature: 99 }).temperature).toBe(2)
    expect(normalize({ temperature: -5 }).temperature).toBe(0)
    expect(normalize({ maxTokens: 1_000_000 }).maxTokens).toBe(4096)
    expect(normalize({ maxTokens: 1 }).maxTokens).toBe(16)
  })

  it('rejects invalid enum values', () => {
    expect(normalize({ precision: 'q3' }).precision).toBe(DEFAULT_SETTINGS.precision)
    expect(normalize({ theme: 'neon' }).theme).toBe(DEFAULT_SETTINGS.theme)
    expect(normalize({ modelId: 'evil/model' }).modelId).toBe(DEFAULT_SETTINGS.modelId)
  })

  it('keeps valid values', () => {
    const s = normalize({ precision: 'fp16', theme: 'dark', reasoning: false })
    expect(s.precision).toBe('fp16')
    expect(s.theme).toBe('dark')
    expect(s.reasoning).toBe(false)
  })
})

describe('load/save (in-memory fallback)', () => {
  it('round-trips a patch', async () => {
    expect((await loadSettings()).temperature).toBe(0.7)
    const next = await saveSettings({ temperature: 1.2, theme: 'dark' })
    expect(next.temperature).toBe(1.2)
    expect(next.theme).toBe('dark')
    expect((await loadSettings()).temperature).toBe(1.2)
  })
})
