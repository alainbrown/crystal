// LLM web worker. Owns the engine, runs load/generate off the main thread,
// and speaks the typed protocol. Engine is selected at build time:
// VITE_LLM_ENGINE=mock uses the deterministic MockEngine (tests / preview).

/// <reference lib="webworker" />
import type { LLMEngine } from './engine'
import { MockEngine } from './mock-engine'
import type { RequestMessage, ResponseMessage } from './protocol'

const USE_MOCK = import.meta.env.VITE_LLM_ENGINE === 'mock'

let enginePromise: Promise<LLMEngine> | null = null

async function getEngine(): Promise<LLMEngine> {
  if (!enginePromise) {
    enginePromise = USE_MOCK
      ? Promise.resolve(new MockEngine())
      : // Lazy-import the heavy real engine only when actually needed.
        import('./transformers-engine').then((m) => new m.TransformersEngine())
  }
  return enginePromise
}

function post(msg: ResponseMessage) {
  ;(self as DedicatedWorkerGlobalScope).postMessage(msg)
}

// Serialize load/generate/dispose so generation never starts before the model
// is loaded. `interrupt` bypasses the queue so it can stop an in-flight run.
let queue: Promise<void> = Promise.resolve()

self.onmessage = (event: MessageEvent<RequestMessage>) => {
  const msg = event.data
  if (msg.type === 'interrupt') {
    void getEngine().then((engine) => engine.interrupt())
    return
  }
  queue = queue.then(() => handle(msg))
}

async function handle(msg: Exclude<RequestMessage, { type: 'interrupt' }>) {
  try {
    switch (msg.type) {
      case 'load': {
        post({ type: 'status', status: 'loading' })
        const engine = await getEngine()
        await engine.load(msg.modelId, msg.options, {
          onProgress: (data) => post({ type: 'progress', data }),
        })
        post({ type: 'ready', modelId: msg.modelId })
        post({ type: 'status', status: 'ready' })
        break
      }
      case 'generate': {
        post({ type: 'status', status: 'generating' })
        const engine = await getEngine()
        const result = await engine.generate(msg.messages, msg.params, {
          onToken: (token, kind) =>
            post({ type: 'token', requestId: msg.requestId, token, kind }),
        })
        post({
          type: 'complete',
          requestId: msg.requestId,
          answer: result.answer,
          reasoning: result.reasoning,
          stats: result.stats,
        })
        post({ type: 'status', status: 'ready' })
        break
      }
      case 'dispose': {
        const engine = await getEngine()
        engine.dispose()
        enginePromise = null
        post({ type: 'status', status: 'idle' })
        break
      }
    }
  } catch (err) {
    post({
      type: 'error',
      requestId: msg.type === 'generate' ? msg.requestId : undefined,
      message: err instanceof Error ? err.message : String(err),
    })
    post({ type: 'status', status: 'error', detail: String(err) })
  }
}
