import type { ModelId } from './models'

export type Role = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  /** Attached images as data URLs (downscaled JPEGs). Kept separate from `content`
   * so persistence/normalization stays string-based; only ModelMessage flattens them
   * into the multimodal parts the Qwen VL chat template expects. */
  images?: string[]
  reasoning?: string
  streaming?: boolean
  createdAt: number
}

/** A multimodal content fragment. Qwen's chat template expects user content as
 * either a plain string or an ordered array of these parts. */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string } // data URL; decoded to pixels in the engine

export interface ModelMessage {
  role: Role
  content: string | ContentPart[]
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

export function userMessage(content: string, images: string[] = [], now = Date.now()): ChatMessage {
  return {
    id: makeId('u'),
    role: 'user',
    content,
    images: images.length ? images : undefined,
    createdAt: now,
  }
}

export function assistantPlaceholder(now = Date.now()): ChatMessage {
  return { id: makeId('a'), role: 'assistant', content: '', streaming: true, createdAt: now }
}

export function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter(
      (m) => m.content.trim().length > 0 || m.role === 'assistant' || (m.images?.length ?? 0) > 0,
    )
    .map((m) => {
      const images = m.images ?? []
      if (images.length === 0) return { role: m.role, content: m.content }
      // Image parts first, then any text — the order the placeholders appear in the
      // rendered template must match the order images are handed to the processor.
      const parts: ContentPart[] = images.map((image) => ({ type: 'image', image }))
      if (m.content.trim().length > 0) parts.push({ type: 'text', text: m.content })
      return { role: m.role, content: parts }
    })
}
