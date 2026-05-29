export type Role = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  reasoning?: string
  streaming?: boolean
  createdAt: number
}

export interface ModelMessage {
  role: Role
  content: string
}

let counter = 0
export function makeId(prefix = 'm'): string {
  counter += 1
  return `${prefix}_${counter}_${Date.now()}`
}

export function userMessage(content: string, now = Date.now()): ChatMessage {
  return { id: makeId('u'), role: 'user', content, createdAt: now }
}

export function assistantPlaceholder(now = Date.now()): ChatMessage {
  return { id: makeId('a'), role: 'assistant', content: '', streaming: true, createdAt: now }
}

export function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((m) => m.content.trim().length > 0 || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
}

const THINK_OPEN = '<think>'
const THINK_CLOSE = '</think>'

export function splitReasoning(raw: string): { reasoning?: string; answer: string } {
  const open = raw.indexOf(THINK_OPEN)
  if (open === -1) return { answer: raw.trimStart() }

  const close = raw.indexOf(THINK_CLOSE, open + THINK_OPEN.length)
  if (close === -1) {
    return { reasoning: raw.slice(open + THINK_OPEN.length).trimStart(), answer: '' }
  }

  const reasoning = raw.slice(open + THINK_OPEN.length, close).trim()
  const answer = raw.slice(close + THINK_CLOSE.length).trimStart()
  return { reasoning: reasoning || undefined, answer }
}

export function cleanToken(text: string): string {
  return text.replace(/<\|im_end\|>/g, '').replace(/<\|endoftext\|>/g, '')
}
