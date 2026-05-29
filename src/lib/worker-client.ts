// Thin typed wrapper around the LLM worker for the UI side.

import type { RequestMessage, ResponseMessage } from '@/worker/protocol'
import { isResponse } from '@/worker/protocol'

export type ResponseListener = (msg: ResponseMessage) => void

export class WorkerClient {
  private worker: Worker
  private listeners = new Set<ResponseListener>()

  constructor() {
    this.worker = new Worker(new URL('../worker/llm.worker.ts', import.meta.url), {
      type: 'module',
      name: 'crystal-llm',
    })
    this.worker.onmessage = (e: MessageEvent) => {
      if (isResponse(e.data)) {
        for (const l of this.listeners) l(e.data)
      }
    }
  }

  on(cb: ResponseListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  send(msg: RequestMessage): void {
    this.worker.postMessage(msg)
  }

  terminate(): void {
    this.worker.terminate()
    this.listeners.clear()
  }
}
