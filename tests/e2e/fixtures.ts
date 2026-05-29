import { test as base, chromium, type BrowserContext } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const EXTENSION_PATH = join(root, 'dist-mock')

// Loads the built (mock-engine) extension into a persistent context and exposes
// its generated extension id. Chromium only supports extensions headed or via
// the new headless mode.
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    // Playwright 1.49+ loads extensions in the default (new) headless mode.
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        '--no-sandbox',
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
