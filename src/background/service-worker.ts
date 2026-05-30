import { env } from '@huggingface/transformers'
import { TransformersEngine } from '@/worker/transformers-engine'
import { queueCapture, type CaptureRect } from '@/lib/capture'
import type { LLMEngine } from '@/worker/engine'
import type { LoadOptions, RequestMessage, ResponseMessage } from '@/worker/protocol'

env.allowLocalModels = false

const ROOT_MENU_ID = 'crystal-capture'
const SHOT_MENU_ID = 'crystal-screenshot'
const REGION_MENU_ID = 'crystal-region'

// Context menus don't survive an extension update and aren't created on browser
// startup, so (re)register on both. removeAll first to avoid a duplicate-id throw.
function registerMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: ROOT_MENU_ID,
      title: 'Send to Crystal',
      contexts: ['page', 'selection', 'image', 'link'],
    })
    chrome.contextMenus.create({
      id: SHOT_MENU_ID,
      parentId: ROOT_MENU_ID,
      title: 'Screenshot visible area',
      contexts: ['page', 'selection', 'image', 'link'],
    })
    chrome.contextMenus.create({
      id: REGION_MENU_ID,
      parentId: ROOT_MENU_ID,
      title: 'Select a region…',
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

// A context-menu click grants activeTab for the clicked tab — exactly what
// captureVisibleTab and scripting.executeScript need, with no broad host permission.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.windowId === undefined || tab.id === undefined) return
  if (info.menuItemId === SHOT_MENU_ID) void captureToPanel(tab.windowId, tab.id, false)
  else if (info.menuItemId === REGION_MENU_ID) void captureToPanel(tab.windowId, tab.id, true)
})

async function captureToPanel(windowId: number, tabId: number, region: boolean): Promise<void> {
  try {
    // Open the panel first, while still inside the click's user gesture (before any
    // await), so the gesture isn't spent by the time we'd want it.
    await chrome.sidePanel.open({ windowId })

    let rect: CaptureRect | undefined
    if (region) {
      // Inject a one-shot selection overlay; it resolves the drawn box (CSS px + dpr)
      // and removes itself before we capture. Null means cancelled / restricted page.
      const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: regionPicker })
      const picked = injection?.result as CaptureRect | null | undefined
      if (!picked) return
      rect = picked
    }

    const url = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 90 })
    await queueCapture({ url, rect })
  } catch (err) {
    console.error('[crystal] capture failed:', err)
  }
}

// Runs in the page (injected via executeScript), so it must be self-contained and use
// only page globals. Draws a rubber-band rectangle and resolves it; removes itself and
// waits two frames before resolving so the overlay isn't in the captured screenshot.
function regionPicker(): Promise<CaptureRect | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;'
    const box = document.createElement('div')
    box.style.cssText =
      'position:fixed;border:2px solid #fff;box-shadow:0 0 0 100vmax rgba(0,0,0,0.4);display:none;pointer-events:none;'
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    let sx = 0
    let sy = 0
    let drawing = false
    const finish = (rect: CaptureRect | null) => {
      overlay.remove()
      document.removeEventListener('keydown', onKey)
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(rect)))
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(null)
    }
    overlay.addEventListener('mousedown', (e: MouseEvent) => {
      drawing = true
      sx = e.clientX
      sy = e.clientY
      box.style.display = 'block'
      box.style.left = `${sx}px`
      box.style.top = `${sy}px`
      box.style.width = '0px'
      box.style.height = '0px'
    })
    overlay.addEventListener('mousemove', (e: MouseEvent) => {
      if (!drawing) return
      box.style.left = `${Math.min(sx, e.clientX)}px`
      box.style.top = `${Math.min(sy, e.clientY)}px`
      box.style.width = `${Math.abs(e.clientX - sx)}px`
      box.style.height = `${Math.abs(e.clientY - sy)}px`
    })
    overlay.addEventListener('mouseup', (e: MouseEvent) => {
      if (!drawing) return
      drawing = false
      const width = Math.abs(e.clientX - sx)
      const height = Math.abs(e.clientY - sy)
      if (width < 5 || height < 5) return finish(null) // treat a tap as cancel
      finish({
        x: Math.min(sx, e.clientX),
        y: Math.min(sy, e.clientY),
        width,
        height,
        dpr: window.devicePixelRatio || 1,
      })
    })
    document.addEventListener('keydown', onKey)
  })
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
