import { useEffect } from 'react'
import type { Theme } from '@/lib/settings'
import { resolveTheme } from '@/lib/theme'

/**
 * Writes the resolved theme to `document.documentElement[data-theme]`.
 * When the choice is "system", it follows the OS preference live.
 */
export function useApplyTheme(theme: Theme): void {
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      root.dataset.theme = resolveTheme(theme)
    }
    apply()
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
