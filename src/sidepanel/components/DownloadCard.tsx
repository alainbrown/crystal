import { getModel } from '@/lib/models'
import { useChatStore } from '@/store/chat-store'

function mb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

export function DownloadCard() {
  const status = useChatStore((s) => s.status)
  const phase = useChatStore((s) => s.loadPhase)
  const progress = useChatStore((s) => s.progress)
  const modelId = useChatStore((s) => s.settings.modelId)

  if (status !== 'loading') return null

  const model = getModel(modelId)
  const name = `${model.family} ${model.label}`

  // Only the download stage has a real percentage; every other stage shows an
  // indeterminate (looping) bar so the long, callback-less compile phase reads as
  // "working" rather than "frozen at 100%".
  const downloading = phase === 'downloading' && !!progress

  let title: string
  let detail: string
  if (downloading && progress) {
    title = 'Downloading model…'
    detail = `${name} · ${mb(progress.loaded)} / ${mb(progress.total)}`
  } else if (phase === 'cache') {
    title = 'Loading from cache…'
    detail = `Preparing ${name}`
  } else if (phase === 'compiling') {
    title = 'Optimizing for your GPU…'
    detail = 'Almost there — compiling the model'
  } else {
    title = 'Warming up your model…'
    detail = `Preparing ${name}`
  }

  const pct = downloading && progress ? Math.round(progress.progress * 100) : 0

  return (
    <div className="dl" role="status" aria-live="polite">
      <div className="dl-top">
        <div className="spinner" />
        <div className="dl-txt">
          {title}
          <span>{detail}</span>
        </div>
      </div>
      <div className={`pbar${downloading ? '' : ' indeterminate'}`}>
        <i style={downloading ? { width: `${pct}%` } : undefined} />
      </div>
    </div>
  )
}
