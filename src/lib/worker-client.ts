import type { RequestMessage, ResponseMessage } from '@/worker/protocol'
import { isResponse } from '@/worker/protocol'

export type ResponseListener = (msg: ResponseMessage) => void

export class WorkerClient {
  private port: chrome.runtime.Port | null = null
  private listeners = new Set<ResponseListener>()

  private connect(): chrome.runtime.Port {
    const port = chrome.runtime.connect({ name: 'crystal-llm' })
    port.onMessage.addListener((data: unknown) => {
      if (isResponse(data)) for (const l of this.listeners) l(data)
    })
    port.onDisconnect.addListener(() => {
      if (this.port === port) this.port = null
    })
    this.port = port
    return port
  }

  on(cb: ResponseListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  send(msg: RequestMessage): void {
    ;(this.port ?? this.connect()).postMessage(msg)
  }

  terminate(): void {
    this.port?.disconnect()
    this.port = null
    this.listeners.clear()
  }
}
