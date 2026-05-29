import { useChatStore } from '@/store/chat-store'

export function StatsBar() {
  const stats = useChatStore((s) => s.stats)

  return (
    <div className="stats">
      <span>
        <b>{stats ? stats.tokensPerSec : '—'}</b> tok/s
      </span>
      <span className="d">·</span>
      <span>
        <b>{stats ? stats.tokens : 0}</b> tokens
      </span>
    </div>
  )
}
