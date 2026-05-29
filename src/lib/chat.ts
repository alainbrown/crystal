// Chat domain types and pure helpers (no React, no chrome APIs) so they can be
// unit-tested directly.

export type Role = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  /** The visible answer text. */
  content: string
  /** Optional chain-of-thought, shown in a collapsible block. */
  reasoning?: string
  /** True while the assistant message is still streaming. */
  streaming?: boolean
  createdAt: number
}

/** The minimal shape the model's chat template expects. */
export interface ModelMessage {
  role: Role
  content: string
}

let counter = 0
/** Stable-ish id without relying on Math.random/Date in hot paths. */
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

/** Convert UI messages to what the model sees (drops reasoning + ui flags). */
export function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((m) => m.content.trim().length > 0 || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
}

const THINK_OPEN = '<think>'
const THINK_CLOSE = '</think>'

/**
 * Split a raw model completion into reasoning + answer. Qwen emits an optional
 * leading `<think>…</think>` block when reasoning mode is on.
 */
export function splitReasoning(raw: string): { reasoning?: string; answer: string } {
  const open = raw.indexOf(THINK_OPEN)
  if (open === -1) return { answer: raw.trimStart() }

  const close = raw.indexOf(THINK_CLOSE, open + THINK_OPEN.length)
  if (close === -1) {
    // Still inside the think block (mid-stream): everything is reasoning so far.
    return { reasoning: raw.slice(open + THINK_OPEN.length).trimStart(), answer: '' }
  }

  const reasoning = raw.slice(open + THINK_OPEN.length, close).trim()
  const answer = raw.slice(close + THINK_CLOSE.length).trimStart()
  return { reasoning: reasoning || undefined, answer }
}

/** Strip stray special tokens that can leak into streamed text. */
export function cleanToken(text: string): string {
  return text.replace(/<\|im_end\|>/g, '').replace(/<\|endoftext\|>/g, '')
}
