import type { RequestMessage, ResponseMessage } from '@/worker/protocol'
import { isResponse } from '@/worker/protocol'

export type ResponseListener = (msg: ResponseMessage) => void

export class WorkerClient {
  private port: chrome.runtime.Port | null = null
  private listeners = new Set<ResponseListener>()
  private disconnectListeners = new Set<() => void>()

  private connect(): chrome.runtime.Port {
    const port = chrome.runtime.connect({ name: 'crystal-llm' })
    port.onMessage.addListener((data: unknown) => {
      if (isResponse(data)) for (const l of this.listeners) l(data)
    })
    port.onDisconnect.addListener(() => {
      // Fires when the MV3 service worker is torn down (idle termination, crash,
      // or update). The worker owns the loaded model, so consumers need to know
      // it's gone — see chat-store's disconnect handler.
      if (this.port === port) this.port = null
      for (const l of this.disconnectListeners) l()
    })
    this.port = port
    return port
  }

  on(cb: ResponseListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.add(cb)
    return () => this.disconnectListeners.delete(cb)
  }

  send(msg: RequestMessage): void {
    try {
      ;(this.port ?? this.connect()).postMessage(msg)
    } catch {
      // The port we held pointed at a service worker that has since been torn
      // down, but onDisconnect hadn't fired yet. Reconnect to a fresh worker.
      this.port = null
      this.connect().postMessage(msg)
    }
  }

  terminate(): void {
    this.port?.disconnect()
    this.port = null
    this.listeners.clear()
    this.disconnectListeners.clear()
  }
}
