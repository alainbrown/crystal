import { useEffect, useState } from 'react'
import { useChatStore } from '@/store/chat-store'
import type { ChatMessage } from '@/lib/chat'

function relativeTime(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

function preview(messages: ChatMessage[]): string {
  const last = messages.at(-1)
  const text = (last?.content ?? '').replace(/\s+/g, ' ').trim()
  return text.length > 80 ? `${text.slice(0, 80).trimEnd()}…` : text
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v5h5" />
      <path d="M3.05 13a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </svg>
  )
}

export function History() {
  const [open, setOpen] = useState(false)
  const conversations = useChatStore((s) => s.conversations)
  const currentId = useChatStore((s) => s.currentId)
  const remember = useChatStore((s) => s.settings.rememberConversations)
  const loadConversation = useChatStore((s) => s.loadConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const newConversation = useChatStore((s) => s.newConversation)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        className="gear"
        title="History"
        onClick={() => setOpen(true)}
        aria-label="Conversation history"
      >
        <HistoryIcon />
      </button>

      {open ? (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <aside
            className="drawer"
            role="dialog"
            aria-label="Conversation history"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <span className="drawer-title">History</span>
              <button
                className="drawer-new"
                onClick={() => {
                  newConversation()
                  setOpen(false)
                }}
              >
                ＋ New chat
              </button>
              <button className="gear" aria-label="Close history" title="Close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <div className="drawer-list">
              {!remember ? (
                <p className="drawer-note">
                  History is off. Turn on “Remember conversations” in settings to save new chats.
                </p>
              ) : null}

              {conversations.length === 0 ? (
                <p className="drawer-empty">No saved conversations yet.</p>
              ) : (
                conversations.map((c) => (
                  <div key={c.id} className={`conv${c.id === currentId ? ' active' : ''}`}>
                    <button
                      className="conv-open"
                      onClick={() => {
                        loadConversation(c.id)
                        setOpen(false)
                      }}
                    >
                      <span className="conv-title">{c.title}</span>
                      <span className="conv-prev">{preview(c.messages)}</span>
                    </button>
                    <span className="conv-side">
                      <span className="conv-time">{relativeTime(c.updatedAt)}</span>
                      <button
                        className="conv-del"
                        aria-label="Delete conversation"
                        title="Delete"
                        onClick={() => void deleteConversation(c.id)}
                      >
                        <TrashIcon />
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
