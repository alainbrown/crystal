import { useLayoutEffect, useRef } from 'react'
import { useCurrentFrame } from 'remotion'
import logoUrl from '@/assets/logo.svg'
import { Dropdown, type DropdownOption } from '@/components/Dropdown'
import { MODELS, formatSize } from '@/lib/models'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { useChatStore } from '@/store/chat-store'
import { Transcript } from '@/sidepanel/components/Transcript'
import { Composer } from '@/sidepanel/components/Composer'
import { StatsBar } from '@/sidepanel/components/StatsBar'
import { snapshotAt } from './timeline'

// Same option list the real ModelSelector builds.
const OPTIONS: DropdownOption[] = MODELS.map((m) => ({
  value: m.id,
  icon: m.icon,
  title: `${m.family} · ${m.label}`,
  sub: `${m.blurb} · ~${formatSize(m.approxDownloadMB)}`,
}))

/**
 * The real Crystal side panel, driven deterministically from the current frame.
 * Header is composed here so the real <Dropdown> can be opened on cue; the
 * transcript, composer, stats and message rendering are the production
 * components, fed by the real Zustand store.
 */
export function Panel() {
  const frame = useCurrentFrame()
  const t = snapshotAt(frame)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Subscribe to messages so this component re-renders once the store update
  // below has flowed into the transcript — the scroll effect then measures the
  // up-to-date content height.
  const messages = useChatStore((s) => s.messages)

  // Push scripted state into the real store before paint (scrub-safe: each
  // frame sets an absolute snapshot, never an increment). The reasoning
  // <details> is forced visible via CSS in demo.css (see `.think-body`), since
  // store-driven re-renders would reset an imperatively-opened element.
  // Keyed on `frame` (not every render): pushing state re-renders this now-
  // subscribed component, and a no-deps effect would setState → re-render → loop.
  useLayoutEffect(() => {
    useChatStore.setState({
      messages: t.messages,
      status: t.status,
      stats: t.stats,
      settings: { ...DEFAULT_SETTINGS, modelId: t.modelId },
      loadedModelId: t.modelId,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame])

  // Keep the transcript pinned to the latest tokens as the answer streams —
  // mirrors the production side panel (App.tsx), so long replies scroll into view.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="panel demo-panel" data-theme="light" ref={panelRef}>
      <header className="panel-header">
        <img className="logo" src={logoUrl} alt="Crystal" />
        <button className="newchat" title="New chat" aria-label="New chat">
          <span className="newchat-plus" aria-hidden="true">＋</span>
          New
        </button>
        <Dropdown
          value={t.modelId}
          options={OPTIONS}
          open={t.dropdownOpen}
          onChange={() => {}}
          ariaLabel="Model"
        />
        <button className="gear" title="Settings" aria-label="Open settings">
          ⚙
        </button>
      </header>
      <Transcript ref={scrollRef} />
      <Composer value={t.typedText} images={t.composerImages} contexts={t.composerContexts} />
      <StatsBar />
    </div>
  )
}
