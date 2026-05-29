import { useState, type KeyboardEvent } from 'react'
import { useChatStore } from '@/store/chat-store'

export function Composer({ value: controlledValue }: { value?: string } = {}) {
  const [localText, setText] = useState('')
  // `value`, when provided, drives the field from outside (the Remotion demo
  // types into it deterministically). Production renders <Composer/> with no
  // props, so behavior is unchanged.
  const text = controlledValue ?? localText
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const status = useChatStore((s) => s.status)
  const generating = status === 'generating'

  function submit() {
    const value = text
    if (!value.trim() || generating) return
    setText('')
    void send(value)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="composer">
      <div className="field">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Share what's on your mind…"
          rows={1}
        />
        <div className="actions">
          {generating ? (
            <button className="iconbtn stop" title="Stop" onClick={stop} aria-label="Stop">
              ⏹
            </button>
          ) : (
            <button
              className="iconbtn send"
              title="Send"
              onClick={submit}
              disabled={!text.trim()}
              aria-label="Send"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
