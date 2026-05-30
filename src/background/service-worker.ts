import { env } from '@huggingface/transformers'
import { TransformersEngine } from '@/worker/transformers-engine'
import { queueCapture } from '@/lib/capture'
import type { LLMEngine } from '@/worker/engine'
import type { LoadOptions, RequestMessage, ResponseMessage } from '@/worker/protocol'

env.allowLocalModels = false

const SCREENSHOT_MENU_ID = 'crystal-screenshot'

// Context menus don't survive an extension update and aren't created on browser
// startup, so (re)register on both. removeAll first to avoid a duplicate-id throw.
function registerMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SCREENSHOT_MENU_ID,
      title: 'Send screenshot to Crystal',
      contexts: ['page', 'selection', 'image', 'link'],
    })
  })
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[crystal] setPanelBehavior failed:', err))
  registerMenus()
})
chrome.runtime.onStartup.addListener(registerMenus)

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {})
  }
})

// A context-menu click grants activeTab for the clicked tab, which is exactly what
// captureVisibleTab needs — no broad host permission. Open the panel first (still
// inside the user gesture, before any await), then capture and hand the shot off via
// chrome.storage.session for the composer to pick up.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== SCREENSHOT_MENU_ID || tab?.windowId === undefined) return
  void captureToPanel(tab.windowId)
})

async function captureToPanel(windowId: number): Promise<void> {
  try {
    await chrome.sidePanel.open({ windowId })
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 85 })
    await queueCapture(dataUrl)
  } catch (err) {
    console.error('[crystal] screenshot capture failed:', err)
  }
}

let engine: LLMEngine | null = null
function getEngine(): LLMEngine {
  return (engine ??= new TransformersEngine())
}

// What the current engine has loaded, so a redundant `load` (e.g. two quick
// sends after the worker restarts) short-circuits instead of re-initializing.
let loaded: { modelId: string; key: string } | null = null
const optionsKey = (o: LoadOptions) => `${o.precision}:${o.cpuFallback}`

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
        const key = optionsKey(msg.options)
        if (loaded && loaded.modelId === msg.modelId && loaded.key === key) {
          post({ type: 'ready', modelId: msg.modelId })
          post({ type: 'status', status: 'ready' })
          break
        }
        post({ type: 'status', status: 'loading' })
        await getEngine().load(msg.modelId, msg.options, {
          onProgress: (data) => post({ type: 'progress', data }),
        })
        loaded = { modelId: msg.modelId, key }
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
        loaded = null
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
