import { test as base, chromium, type BrowserContext } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const EXTENSION_PATH = join(root, 'dist')

// Loads the real (WebGPU) extension build into a persistent context and exposes
// its generated extension id. This exercises the actual transformers.js engine
// — no mock — so it requires a WebGPU-capable Chromium and downloads the model
// on first run. Intended to run locally/headed, not in a GPU-less CI.
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        '--no-sandbox',
        // Best-effort WebGPU in automation (falls back to SwiftShader).
        '--enable-unsafe-webgpu',
        '--enable-features=Vulkan',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent('serviceworker')
    const id = new URL(sw.url()).host
    await use(id)
  },
})

export const expect = test.expect
