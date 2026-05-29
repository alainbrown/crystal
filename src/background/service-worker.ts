import { env } from '@huggingface/transformers'
import { TransformersEngine } from '@/worker/transformers-engine'
import type { LLMEngine } from '@/worker/engine'
import type { RequestMessage, ResponseMessage } from '@/worker/protocol'

env.allowLocalModels = false

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[crystal] setPanelBehavior failed:', err))
})

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {})
  }
})

let engine: LLMEngine | null = null
function getEngine(): LLMEngine {
  return (engine ??= new TransformersEngine())
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'crystal-llm') return

  const post = (msg: ResponseMessage) => {
    try {
      port.postMessage(msg)
    } catch {
      // ignore
    }
  }

  let queue: Promise<void> = Promise.resolve()
  port.onMessage.addListener((msg: RequestMessage) => {
    if (msg.type === 'interrupt') {
      getEngine().interrupt()
      return
    }
    queue = queue.then(() => handle(msg, post))
  })
})

async function handle(
  msg: Exclude<RequestMessage, { type: 'interrupt' }>,
  post: (msg: ResponseMessage) => void,
) {
  try {
    switch (msg.type) {
      case 'load': {
        post({ type: 'status', status: 'loading' })
        await getEngine().load(msg.modelId, msg.options, {
          onProgress: (data) => post({ type: 'progress', data }),
        })
        post({ type: 'ready', modelId: msg.modelId })
        post({ type: 'status', status: 'ready' })
        break
      }
      case 'generate': {
        post({ type: 'status', status: 'generating' })
        const result = await getEngine().generate(msg.messages, msg.params, {
          onToken: (token, kind) => post({ type: 'token', requestId: msg.requestId, token, kind }),
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
        getEngine().dispose()
        engine = null
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
