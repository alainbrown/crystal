import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __setClientFactory, useChatStore } from '@/store/chat-store'
import type { WorkerClient } from '@/lib/worker-client'
import type { RequestMessage, ResponseMessage } from '@/worker/protocol'
import { MockEngine } from '@/worker/mock-engine'
import { DEFAULT_MODEL_ID } from '@/lib/models'
import { __testing as convTesting } from '@/lib/conversations'

// Mirrors the FakeClient in store.test.ts: drives the deterministic MockEngine over the
// same message protocol the real WorkerClient speaks.
class FakeClient {
  private listeners = new Set<(m: ResponseMessage) => void>()
  private engine = new MockEngine({ stepMs: 0, chunks: 2 })
  private queue: Promise<void> = Promise.resolve()

  on(cb: (m: ResponseMessage) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private emit(msg: ResponseMessage) {
    for (const l of this.listeners) l(msg)
  }

  send(msg: RequestMessage) {
    if (msg.type === 'interrupt') {
      this.engine.interrupt()
      return
    }
    this.queue = this.queue.then(() => this.handle(msg))
  }

  private async handle(msg: Exclude<RequestMessage, { type: 'interrupt' }>) {
    if (msg.type === 'load') {
      this.emit({ type: 'status', status: 'loading' })
      await this.engine.load(msg.modelId, msg.options, {
        onProgress: (data) => this.emit({ type: 'progress', data }),
      })
      this.emit({ type: 'ready', modelId: msg.modelId })
      this.emit({ type: 'status', status: 'ready' })
    } else if (msg.type === 'generate') {
      this.emit({ type: 'status', status: 'generating' })
      const r = await this.engine.generate(msg.messages, msg.params, {
        onToken: (token, kind) => this.emit({ type: 'token', requestId: msg.requestId, token, kind }),
      })
      this.emit({
        type: 'complete',
        requestId: msg.requestId,
        answer: r.answer,
        reasoning: r.reasoning,
        stats: r.stats,
      })
      this.emit({ type: 'status', status: 'ready' })
    }
  }

  terminate() {}
}

const store = useChatStore

async function sendAndSettle(text: string) {
  await store.getState().send(text)
  await vi.waitFor(() => expect(store.getState().activeRequestId).toBeNull())
  // persistCurrent runs in a fire-and-forget microtask after `complete`.
  await vi.waitFor(() => expect(store.getState().messages.at(-1)?.streaming).toBe(false))
}

beforeEach(async () => {
  convTesting.resetMemory()
  __setClientFactory(() => new FakeClient() as unknown as WorkerClient)
  store.setState({
    messages: [],
    conversations: [],
    currentId: null,
    stats: null,
    error: null,
    activeRequestId: null,
    loadedModelId: null,
  })
  await store.getState().init()
  await vi.waitFor(() => expect(store.getState().loadedModelId).toBe(DEFAULT_MODEL_ID))
})

describe('conversation history', () => {
  it('autosaves a sent turn and titles it from the first user message', async () => {
    await sendAndSettle('what is the capital of France')

    await vi.waitFor(() => expect(store.getState().conversations).toHaveLength(1))
    const { conversations, currentId } = store.getState()
    expect(currentId).toBe(conversations[0].id)
    expect(conversations[0].title).toBe('what is the capital of France')
    expect(conversations[0].messages.some((m) => m.role === 'assistant' && m.content)).toBe(true)
  })

  it('newConversation starts fresh, then a new send creates a second entry', async () => {
    await sendAndSettle('first chat')
    const firstId = store.getState().currentId

    store.getState().newConversation()
    expect(store.getState().messages).toEqual([])
    expect(store.getState().currentId).toBeNull()

    await sendAndSettle('second chat')
    await vi.waitFor(() => expect(store.getState().conversations).toHaveLength(2))
    expect(store.getState().currentId).not.toBe(firstId)
  })

  it('loadConversation restores messages and currentId', async () => {
    await sendAndSettle('remember me')
    const saved = store.getState().conversations[0]
    store.getState().newConversation()

    store.getState().loadConversation(saved.id)
    expect(store.getState().currentId).toBe(saved.id)
    expect(store.getState().messages).toEqual(saved.messages)
  })

  it('deleteConversation removes it and clears the panel when it was current', async () => {
    await sendAndSettle('delete me')
    const { id } = store.getState().conversations[0]

    await store.getState().deleteConversation(id)
    expect(store.getState().conversations).toHaveLength(0)
    expect(store.getState().currentId).toBeNull()
    expect(store.getState().messages).toEqual([])
  })

  it('does not persist when rememberConversations is off', async () => {
    store.setState({ settings: { ...store.getState().settings, rememberConversations: false } })

    await sendAndSettle('do not save this')

    expect(store.getState().conversations).toHaveLength(0)
    expect(store.getState().currentId).toBeNull()
  })
})
