import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chat-store'
import { Header } from './components/Header'
import { ModelSelector } from './components/ModelSelector'
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

  // Reflect theme/size on the document so tokens.css variables switch.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.size = textSize
  }, [theme, textSize])

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="panel">
      <Header />
      <ModelSelector />
      <DownloadCard />
      <Transcript ref={scrollRef} />
      <Composer />
      <StatsBar />
    </div>
  )
}
