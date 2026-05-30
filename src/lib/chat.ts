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
  /** Page text pulled in via "Send page text", prepended to the model turn as context. */
  contexts?: PageContext[]
  reasoning?: string
  streaming?: boolean
  createdAt: number
}

/** Readable text extracted from a web page and sent along as context for a turn. */
export interface PageContext {
  title: string
  url: string
  text: string
  /** Word count of the included (possibly truncated) text — shown on the chip. */
  words: number
  truncated: boolean
}

// Cap how much page text rides along, so one big page can't crowd out the chat in the
// model's context window (or bloat chrome.storage). ~20k chars ≈ a few thousand tokens.
export const MAX_CONTEXT_CHARS = 20_000

/** Normalize raw extracted text into a PageContext, truncating to the budget. */
export function toPageContext(raw: { title: string; url: string; text: string }): PageContext {
  const full = raw.text.trim()
  const truncated = full.length > MAX_CONTEXT_CHARS
  const text = truncated ? full.slice(0, MAX_CONTEXT_CHARS) : full
  return {
    title: raw.title.trim() || raw.url,
    url: raw.url,
    text,
    words: text ? text.split(/\s+/).length : 0,
    truncated,
  }
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

export interface UserMessageExtras {
  images?: string[]
  contexts?: PageContext[]
}

export function userMessage(
  content: string,
  extras: UserMessageExtras = {},
  now = Date.now(),
): ChatMessage {
  return {
    id: makeId('u'),
    role: 'user',
    content,
    images: extras.images?.length ? extras.images : undefined,
    contexts: extras.contexts?.length ? extras.contexts : undefined,
    createdAt: now,
  }
}

export function assistantPlaceholder(now = Date.now()): ChatMessage {
  return { id: makeId('a'), role: 'assistant', content: '', streaming: true, createdAt: now }
}

function contextBlock(c: PageContext): string {
  return `<page_context title="${c.title}" url="${c.url}">\n${c.text}\n</page_context>`
}

/** Combine attached page context with the user's typed text into one text block. */
function composeText(m: ChatMessage): string {
  const prefix = (m.contexts ?? []).map(contextBlock).join('\n\n')
  if (!prefix) return m.content
  return m.content.trim() ? `${prefix}\n\n${m.content}` : prefix
}

export function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter(
      (m) =>
        m.content.trim().length > 0 ||
        m.role === 'assistant' ||
        (m.images?.length ?? 0) > 0 ||
        (m.contexts?.length ?? 0) > 0,
    )
    .map((m) => {
      const images = m.images ?? []
      const text = composeText(m)
      if (images.length === 0) return { role: m.role, content: text }
      // Image parts first, then any text — the order the placeholders appear in the
      // rendered template must match the order images are handed to the processor.
      const parts: ContentPart[] = images.map((image) => ({ type: 'image', image }))
      if (text.trim().length > 0) parts.push({ type: 'text', text })
      return { role: m.role, content: parts }
    })
}
