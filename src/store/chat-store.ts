import { create } from 'zustand'
import {
  assistantPlaceholder,
  makeId,
  toModelMessages,
  userMessage,
  type ChatMessage,
} from '@/lib/chat'
import { type ModelId } from '@/lib/models'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  subscribeSettings,
  type Settings,
} from '@/lib/settings'
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

  init: () => Promise<void>
  send: (text: string) => Promise<void>
  stop: () => void
  reset: () => void
  applySettings: (s: Settings) => void
}

let clientFactory: () => WorkerClient = () => new WorkerClient()
export function __setClientFactory(f: () => WorkerClient) {
  clientFactory = f
}

let client: WorkerClient | null = null
let unsubscribeSettings: (() => void) | null = null

export const useChatStore = create<ChatState>((set, get) => {
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
        break
      case 'error':
        patchAssistant((m) => ({ ...m, streaming: false }))
        set({ error: msg.message, activeRequestId: null })
        break
    }
  }

  function ensureClient(): WorkerClient {
    if (!client) {
      client = clientFactory()
      client.on(handle)
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

    init: async () => {
      const settings = await loadSettings()
      set({ settings })
      unsubscribeSettings?.()
      unsubscribeSettings = subscribeSettings((s) => get().applySettings(s))
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

    send: async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const { settings } = get()
      const requestId = makeId('req')

      const history = [...get().messages, userMessage(trimmed)]
      const placeholder = assistantPlaceholder()
      set({
        messages: [...history, placeholder],
        error: null,
        stats: null,
        activeRequestId: requestId,
      })

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
    },

    reset: () => set({ messages: [], stats: null, error: null }),
  }
})
