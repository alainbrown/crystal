import { MODELS } from '@/lib/models'
import { saveSettings } from '@/lib/settings'
import { useChatStore } from '@/store/chat-store'

export function ModelSelector() {
  const current = useChatStore((s) => s.settings.modelId)
  const status = useChatStore((s) => s.status)
  const busy = status === 'loading' || status === 'generating'

  return (
    <div className="models inset" role="tablist" aria-label="Model size">
      {MODELS.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={m.id === current}
          className={`seg${m.id === current ? ' on' : ''}`}
          disabled={busy && m.id !== current}
          onClick={() => void saveSettings({ modelId: m.id })}
        >
          {m.label}
          <small>{m.family}</small>
        </button>
      ))}
    </div>
  )
}
