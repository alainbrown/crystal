import { create } from 'zustand'
import {
  assistantPlaceholder,
  conversationTitle,
  makeId,
  toModelMessages,
  userMessage,
  type ChatMessage,
  type Conversation,
  type PageContext,
} from '@/lib/chat'
import { type ModelId } from '@/lib/models'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  subscribeSettings,
  type Settings,
} from '@/lib/settings'
import {
  loadConversations,
  removeConversation,
  saveConversation,
  subscribeConversations,
} from '@/lib/conversations'
import { WorkerClient } from '@/lib/worker-client'
import type { EngineStatus, FileProgress, GenStats } from '@/worker/protocol'

export interface ChatState {
  status: EngineStatus
  progress: FileProgress | null
  loadedModelId: ModelId | null
  messages: ChatMessage[]
  stats: GenStats | null
  error: string | null
  settings: Settings
  activeRequestId: string | null
  conversations: Conversation[]
  currentId: string | null

  init: () => Promise<void>
  send: (text: string, images?: string[], contexts?: PageContext[]) => Promise<void>
  stop: () => void
  reset: () => void
  applySettings: (s: Settings) => void
  newConversation: () => void
  loadConversation: (id: string) => void
  deleteConversation: (id: string) => Promise<void>
}

let clientFactory: () => WorkerClient = () => new WorkerClient()
export function __setClientFactory(f: () => WorkerClient) {
  clientFactory = f
  // Drop any client from a previous factory so the next ensureClient() builds a
  // fresh one. Test-only hook; production never swaps the factory.
  client?.terminate()
  client = null
}

let client: WorkerClient | null = null
let unsubscribeSettings: (() => void) | null = null
let unsubscribeConversations: (() => void) | null = null

export const useChatStore = create<ChatState>((set, get) => {
  // Snapshot the active chat into the persisted conversation list. Gated on the
  // rememberConversations setting; skips the empty assistant placeholder that exists
  // mid-stream so a half-finished turn doesn't store a blank bubble. Mints currentId on
  // first save so subsequent saves of the same chat replace it rather than duplicate.
  async function persistCurrent(): Promise<void> {
    const { settings, currentId } = get()
    if (!settings.rememberConversations) return
    const messages = get().messages.filter((m) => !(m.streaming && !m.content && !m.reasoning))
    if (messages.length === 0) return
    const now = Date.now()
    const existing = currentId ? get().conversations.find((c) => c.id === currentId) : undefined
    const conv: Conversation = {
      id: currentId ?? makeId('conv'),
      title: conversationTitle(messages),
      messages: [...messages],
      modelId: settings.modelId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    if (!currentId) set({ currentId: conv.id })
    set({ conversations: await saveConversation(conv) })
  }

  function patchAssistant(fn: (m: ChatMessage) => ChatMessage) {
    set((state) => {
      const messages = [...state.messages]
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          messages[i] = fn(messages[i])
          break
        }
      }
      return { messages }
    })
  }

  function handle(msg: Parameters<Parameters<WorkerClient['on']>[0]>[0]) {
    switch (msg.type) {
      case 'status':
        set({ status: msg.status })
        if (msg.status === 'error' && msg.detail) set({ error: msg.detail })
        break
      case 'progress':
        set({ progress: msg.data })
        break
      case 'ready':
        set({ loadedModelId: msg.modelId, progress: null })
        break
      case 'token':
        if (msg.requestId !== get().activeRequestId) return
        patchAssistant((m) =>
          msg.kind === 'reasoning'
            ? { ...m, reasoning: (m.reasoning ?? '') + msg.token }
            : { ...m, content: m.content + msg.token },
        )
        break
      case 'complete':
        if (msg.requestId !== get().activeRequestId) return
        patchAssistant((m) => ({
          ...m,
          content: msg.answer,
          reasoning: msg.reasoning ?? m.reasoning,
          streaming: false,
        }))
        set({ stats: msg.stats, activeRequestId: null })
        void persistCurrent()
        break
      case 'error':
        patchAssistant((m) => ({ ...m, streaming: false }))
        set({ error: msg.message, activeRequestId: null })
        void persistCurrent()
        break
    }
  }

  // The MV3 service worker that owns the loaded model is terminated after ~30s
  // idle. When that happens the port disconnects: forget the loaded model so the
  // next send transparently reloads it (from browser cache, no re-download)
  // instead of generating against an empty worker and hitting "Model not loaded".
  // Without this, loadedModelId stays stale and the only recovery is reloading
  // the extension.
  function handleDisconnect() {
    set({ loadedModelId: null })
    // If a generation was streaming when the worker died, it will never finish —
    // stop the spinner and surface a soft error so the user can resend.
    if (get().activeRequestId) {
      patchAssistant((m) => ({ ...m, streaming: false }))
      set({
        status: 'idle',
        activeRequestId: null,
        error: 'The model worker stopped before finishing. Send your message again to retry.',
      })
    } else if (get().status !== 'error') {
      set({ status: 'idle' })
    }
  }

  function ensureClient(): WorkerClient {
    if (!client) {
      client = clientFactory()
      client.on(handle)
      client.onDisconnect?.(handleDisconnect)
    }
    return client
  }

  function ensureLoaded() {
    const { settings, loadedModelId, status } = get()
    if (loadedModelId === settings.modelId) return
    if (status === 'loading') return
    ensureClient().send({
      type: 'load',
      modelId: settings.modelId,
      options: { precision: settings.precision, cpuFallback: settings.cpuFallback },
    })
  }

  return {
    status: 'idle',
    progress: null,
    loadedModelId: null,
    messages: [],
    stats: null,
    error: null,
    settings: DEFAULT_SETTINGS,
    activeRequestId: null,
    conversations: [],
    currentId: null,

    init: async () => {
      const [settings, conversations] = await Promise.all([loadSettings(), loadConversations()])
      set({ settings, conversations })
      unsubscribeSettings?.()
      unsubscribeSettings = subscribeSettings((s) => get().applySettings(s))
      unsubscribeConversations?.()
      unsubscribeConversations = subscribeConversations((list) => set({ conversations: list }))
      ensureClient()
      ensureLoaded()
    },

    applySettings: (s: Settings) => {
      const prev = get().settings
      set({ settings: s })
      if (
        s.modelId !== prev.modelId ||
        s.precision !== prev.precision ||
        s.cpuFallback !== prev.cpuFallback
      ) {
        set({ loadedModelId: null })
        ensureLoaded()
      }
    },

    send: async (text: string, images: string[] = [], contexts: PageContext[] = []) => {
      const trimmed = text.trim()
      if (!trimmed && images.length === 0 && contexts.length === 0) return
      const { settings } = get()
      const requestId = makeId('req')

      const history = [...get().messages, userMessage(trimmed, { images, contexts })]
      const placeholder = assistantPlaceholder()
      set({
        messages: [...history, placeholder],
        error: null,
        stats: null,
        activeRequestId: requestId,
      })

      // Persist the user turn immediately so the conversation shows up in history even
      // if the panel closes before the reply finishes.
      void persistCurrent()

      ensureLoaded()
      ensureClient().send({
        type: 'generate',
        requestId,
        messages: toModelMessages(history),
        params: {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          reasoning: settings.reasoning,
        },
      })
    },

    stop: () => {
      client?.send({ type: 'interrupt' })
      patchAssistant((m) => ({ ...m, streaming: false }))
      set({ activeRequestId: null })
      void persistCurrent()
    },

    reset: () => set({ messages: [], stats: null, error: null }),

    // Start a fresh chat. The previous one is already persisted via autosave; clearing
    // currentId means the next send mints a new conversation rather than overwriting it.
    newConversation: () => set({ messages: [], currentId: null, stats: null, error: null }),

    loadConversation: (id: string) => {
      const conv = get().conversations.find((c) => c.id === id)
      if (!conv) return
      set({ messages: conv.messages, currentId: conv.id, stats: null, error: null })
    },

    deleteConversation: async (id: string) => {
      set({ conversations: await removeConversation(id) })
      if (get().currentId === id) {
        set({ messages: [], currentId: null, stats: null, error: null })
      }
    },
  }
})
