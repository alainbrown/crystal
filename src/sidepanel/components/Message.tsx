import type { ChatMessage } from '@/lib/chat'
import { ThinkingBlock } from './ThinkingBlock'

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div>
        <div className="lbl r">you</div>
        <div className="bubble from-user">{message.content}</div>
      </div>
    )
  }

  const showTyping = message.streaming && message.content.length === 0
  return (
    <div>
      <div className="lbl">crystal</div>
      <div className="bubble from-bot">
        {message.reasoning ? <ThinkingBlock reasoning={message.reasoning} /> : null}
        {message.content}
        {showTyping ? (
          <span className="typing" aria-label="thinking">
            <i />
            <i />
            <i />
          </span>
        ) : null}
        {message.streaming && message.content.length > 0 ? (
          <span className="caret" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  )
}
