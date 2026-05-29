import { useEffect, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  subscribeSettings,
  type Settings,
} from '@/lib/settings'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    loadSettings().then((s) => {
      if (alive) {
        setSettings(s)
        setLoaded(true)
      }
    })
    const unsub = subscribeSettings((s) => alive && setSettings(s))
    return () => {
      alive = false
      unsub()
    }
  }, [])

  async function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }))
    await saveSettings(patch)
  }

  return { settings, loaded, update }
}
