import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chat-store'
import { useApplyTheme } from '@/hooks/useApplyTheme'
import { Header } from './components/Header'
import { DownloadCard } from './components/DownloadCard'
import { Transcript } from './components/Transcript'
import { Composer } from './components/Composer'
import { StatsBar } from './components/StatsBar'

export function App() {
  const init = useChatStore((s) => s.init)
  const theme = useChatStore((s) => s.settings.theme)
  const textSize = useChatStore((s) => s.settings.textSize)
  const messages = useChatStore((s) => s.messages)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void init()
  }, [init])

  useApplyTheme(theme)

  useEffect(() => {
    document.documentElement.dataset.size = textSize
  }, [textSize])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="panel">
      <Header />
      <DownloadCard />
      <Transcript ref={scrollRef} />
      <Composer />
      <StatsBar />
    </div>
  )
}
