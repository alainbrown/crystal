import { describe, expect, it, vi } from 'vitest'
import { __setClientFactory, useChatStore } from '@/store/chat-store'
import type { WorkerClient } from '@/lib/worker-client'
import type { RequestMessage, ResponseMessage } from '@/worker/protocol'
import { MockEngine } from '@/worker/mock-engine'
import { DEFAULT_MODEL_ID } from '@/lib/models'

class FakeClient {
  private listeners = new Set<(m: ResponseMessage) => void>()
  private disconnectListeners = new Set<() => void>()
  private engine = new MockEngine({ stepMs: 0, chunks: 3 })
  private queue: Promise<void> = Promise.resolve()

  on(cb: (m: ResponseMessage) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  onDisconnect(cb: () => void) {
    this.disconnectListeners.add(cb)
    return () => this.disconnectListeners.delete(cb)
  }

  // Simulate MV3 idle termination: the service worker dies, taking the loaded
  // model with it, and a fresh (empty) engine comes up in its place.
  killWorker() {
    this.engine = new MockEngine({ stepMs: 0, chunks: 3 })
    for (const l of this.disconnectListeners) l()
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

describe('chat store', () => {
  it('loads the model then streams a reply into the trailing assistant message', async () => {
    __setClientFactory(() => new FakeClient() as unknown as WorkerClient)
    const store = useChatStore

    await store.getState().init()
    await vi.waitFor(() => expect(store.getState().loadedModelId).toBe(DEFAULT_MODEL_ID))

    // Reasoning is off by default now; enable it to exercise the reasoning stream.
    store.setState({ settings: { ...store.getState().settings, reasoning: true } })

    await store.getState().send('hello there')
    await vi.waitFor(() => {
      const last = store.getState().messages.at(-1)
      expect(last?.role).toBe('assistant')
      expect(last?.streaming).toBe(false)
    })

    const msgs = store.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0]).toMatchObject({ role: 'user', content: 'hello there' })
    expect(msgs[1].content).toContain('hello there')
    expect(msgs[1].reasoning).toBeTruthy()
    expect(store.getState().stats?.tokens).toBeGreaterThan(0)
    expect(store.getState().error).toBeNull()
  })

  it('transparently reloads after the service worker is terminated while idle', async () => {
    const fake = new FakeClient()
    __setClientFactory(() => fake as unknown as WorkerClient)
    const store = useChatStore
    store.setState({ messages: [], currentId: null, error: null, stats: null })

    await store.getState().init()
    await vi.waitFor(() => expect(store.getState().loadedModelId).toBe(DEFAULT_MODEL_ID))

    // The MV3 worker is killed after sitting idle. The store should forget the
    // model so it isn't left pointing at a worker that no longer has it loaded.
    fake.killWorker()
    expect(store.getState().loadedModelId).toBeNull()

    // The next message must reload (from cache) and succeed — not error with
    // "Model not loaded" the way it did before.
    await store.getState().send('still there?')
    await vi.waitFor(() => {
      const last = store.getState().messages.at(-1)
      expect(last?.role).toBe('assistant')
      expect(last?.streaming).toBe(false)
    })

    expect(store.getState().error).toBeNull()
    expect(store.getState().loadedModelId).toBe(DEFAULT_MODEL_ID)
    expect(store.getState().messages.at(-1)?.content).toContain('still there?')
  })
})
