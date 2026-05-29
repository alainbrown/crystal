import { forwardRef } from 'react'
import { useChatStore } from '@/store/chat-store'
import { Message } from './Message'

export const Transcript = forwardRef<HTMLDivElement>(function Transcript(_props, ref) {
  const messages = useChatStore((s) => s.messages)
  const error = useChatStore((s) => s.error)

  return (
    <div className="scroll" ref={ref}>
      {messages.length === 0 ? (
        <div className="empty">
          <div className="empty-gem">💎</div>
          <p className="empty-title">Nothing leaves this device.</p>
          <p className="empty-sub">
            Crystal runs the model on your own GPU — no server, no API key. Say anything.
          </p>
        </div>
      ) : (
        messages.map((m) => <Message key={m.id} message={m} />)
      )}

      {error ? <div className="err">{error}</div> : null}
    </div>
  )
})
