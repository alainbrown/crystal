import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTheme, systemPrefersDark } from '@/lib/theme'

function stubMatchMedia(matches: boolean) {
  // jsdom doesn't implement matchMedia; stub it on the global (which is window).
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches,
    media,
    addEventListener() {},
    removeEventListener() {},
  }))
}

describe('resolveTheme', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passes explicit choices through unchanged', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('resolves "system" from the OS preference', () => {
    stubMatchMedia(true)
    expect(resolveTheme('system')).toBe('dark')
    expect(systemPrefersDark()).toBe(true)

    stubMatchMedia(false)
    expect(resolveTheme('system')).toBe('light')
    expect(systemPrefersDark()).toBe(false)
  })

  it('treats a missing matchMedia as light (not dark)', () => {
    expect(systemPrefersDark()).toBe(false) // no matchMedia stubbed
    expect(resolveTheme('system')).toBe('light')
  })
})
