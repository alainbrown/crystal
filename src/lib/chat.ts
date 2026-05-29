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
