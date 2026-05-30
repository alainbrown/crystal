import type { ModelId } from './models'

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

/** A persisted chat session: its messages plus the metadata the history list needs. */
export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  modelId: ModelId
  createdAt: number
  updatedAt: number
}

/** Derive a one-line title from the first non-empty user message. */
export function conversationTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.content.trim().length > 0)
  const raw = firstUser?.content.trim().replace(/\s+/g, ' ') ?? ''
  if (!raw) return 'New chat'
  return raw.length > 60 ? `${raw.slice(0, 60).trimEnd()}…` : raw
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
