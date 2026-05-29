import { getModel } from '@/lib/models'
import { useChatStore } from '@/store/chat-store'

function mb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

export function DownloadCard() {
  const status = useChatStore((s) => s.status)
  const progress = useChatStore((s) => s.progress)
  const modelId = useChatStore((s) => s.settings.modelId)

  if (status !== 'loading') return null

  const model = getModel(modelId)
  const pct = progress ? Math.round(progress.progress * 100) : 0
  const detail = progress
    ? `Downloading weights · ${mb(progress.loaded)} / ${mb(progress.total)}`
    : `Preparing ${model.family} ${model.label}…`

  return (
    <div className="dl soft" role="status" aria-live="polite">
      <div className="dl-top">
        <div className="spinner" />
        <div className="dl-txt">
          Warming up your model…
          <span>{detail}</span>
        </div>
      </div>
      <div className="pbar inset">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
