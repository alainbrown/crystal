import { isModelId, DEFAULT_MODEL_ID } from './models'
import type { Conversation, ChatMessage, Role } from './chat'

// One key holds the whole list (newest first). chrome.storage.local is ~10 MB without
// `unlimitedStorage` (which we don't request), so cap the list and prune the oldest
// rather than risk a write that exceeds quota.
const STORAGE_KEY = 'crystal.conversations'
const MAX_CONVERSATIONS = 50

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local
}

// In-memory fallback for environments without chrome.storage (unit tests, SSR).
let memory: Conversation[] = []

const ROLES: Role[] = ['system', 'user', 'assistant']

function normalizeMessage(raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  if (!ROLES.includes(m.role as Role)) return null
  if (typeof m.content !== 'string') return null
  const images = Array.isArray(m.images)
    ? m.images.filter((x): x is string => typeof x === 'string')
    : undefined
  return {
    id: typeof m.id === 'string' ? m.id : `m_${Math.round(Number(m.createdAt) || 0)}`,
    role: m.role as Role,
    content: m.content,
    images: images && images.length ? images : undefined,
    reasoning: typeof m.reasoning === 'string' ? m.reasoning : undefined,
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0,
  }
}

function normalizeOne(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (typeof c.id !== 'string') return null
  if (!Array.isArray(c.messages)) return null
  const messages = c.messages.map(normalizeMessage).filter((m): m is ChatMessage => m !== null)
  if (messages.length === 0) return null
  return {
    id: c.id,
    title: typeof c.title === 'string' && c.title ? c.title : 'New chat',
    messages,
    modelId: isModelId(c.modelId) ? c.modelId : DEFAULT_MODEL_ID,
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : 0,
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
  }
}

/** Validate, sort newest-first, and cap to MAX_CONVERSATIONS. */
export function normalizeList(raw: unknown): Conversation[] {
  if (!Array.isArray(raw)) return []
  const list = raw.map(normalizeOne).filter((c): c is Conversation => c !== null)
  return sortPrune(list)
}

function sortPrune(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS)
}

async function writeList(list: Conversation[]): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: list })
  } else {
    memory = list
  }
}

export async function loadConversations(): Promise<Conversation[]> {
  if (!hasChromeStorage()) return memory
  const data = await chrome.storage.local.get(STORAGE_KEY)
  return normalizeList(data[STORAGE_KEY])
}

/** Insert or replace a conversation by id, returning the updated (sorted, pruned) list. */
export async function saveConversation(conv: Conversation): Promise<Conversation[]> {
  const list = await loadConversations()
  const next = sortPrune([conv, ...list.filter((c) => c.id !== conv.id)])
  await writeList(next)
  return next
}

export async function removeConversation(id: string): Promise<Conversation[]> {
  const list = await loadConversations()
  const next = list.filter((c) => c.id !== id)
  await writeList(next)
  return next
}

export function subscribeConversations(cb: (list: Conversation[]) => void): () => void {
  if (!hasChromeStorage() || !chrome.storage.onChanged) return () => {}
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      cb(normalizeList(changes[STORAGE_KEY].newValue))
    }
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}

export const __testing = {
  STORAGE_KEY,
  MAX_CONVERSATIONS,
  resetMemory: () => {
    memory = []
  },
}
