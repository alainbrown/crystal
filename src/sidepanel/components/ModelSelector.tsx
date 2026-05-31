import { Dropdown, type DropdownOption } from '@/components/Dropdown'
import { MODELS, formatSize, type ModelId } from '@/lib/models'
import { saveSettings } from '@/lib/settings'
import { useChatStore } from '@/store/chat-store'

const OPTIONS: DropdownOption[] = MODELS.map((m) => ({
  value: m.id,
  icon: m.icon,
  title: `${m.family} · ${m.label}`,
  sub: `${m.blurb} · ~${formatSize(m.approxDownloadMB)}`,
  triggerLabel: `${m.family} ${m.label}`,
}))

export function ModelSelector() {
  const current = useChatStore((s) => s.settings.modelId)
  const status = useChatStore((s) => s.status)
  const busy = status === 'loading' || status === 'generating'

  return (
    <Dropdown
      value={current}
      options={OPTIONS}
      disabled={busy}
      ariaLabel="Model"
      onChange={(modelId) => void saveSettings({ modelId: modelId as ModelId })}
    />
  )
}
