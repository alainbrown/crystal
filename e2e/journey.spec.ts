import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { expect, test, withPageErrorWatch } from './fixtures'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const EXT_DIR = join(REPO_ROOT, 'dist')
const MANIFEST = join(EXT_DIR, 'manifest.json')

const PROMPT = 'Reply with a short, friendly greeting.'

test.beforeAll(() => {
  if (!existsSync(MANIFEST)) {
    throw new Error(
      "Extension is not built. Run 'pnpm build' before 'pnpm exec playwright test', or use 'pnpm test:e2e'.",
    )
  }
})

test('crystal full journey on the loaded extension', async () => {
  test.setTimeout(10 * 60_000)

  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,SharedArrayBuffer',
      '--use-angle=default',
      '--no-sandbox',
    ],
  })
  try {
    let [sw] = ctx.serviceWorkers()
    if (!sw) sw = await ctx.waitForEvent('serviceworker')
    const extId = new URL(sw.url()).hostname

    const page = await ctx.newPage()
    await withPageErrorWatch(page, 'crystal full journey', async () => {
      await page.goto(`chrome-extension://${extId}/src/sidepanel/index.html`)

      await page.evaluate(async () => {
        await chrome.storage.local.clear()
        await chrome.storage.local.set({
          'crystal.settings': { temperature: 0, maxTokens: 48, reasoning: false },
        })
        for (const k of await caches.keys()) await caches.delete(k)
      })
      await page.reload()

      await expect(page.getByText('Nothing leaves this device.')).toBeVisible()
      await expect(page.getByText('Warming up your model…')).toBeVisible()

      const input = page.getByPlaceholder("Share what's on your mind…")
      await input.fill(PROMPT)
      await page.getByRole('button', { name: 'Send' }).click()

      await expect(page.locator('.from-user')).toHaveText(PROMPT)

      const bot = page.locator('.from-bot').last()
      await expect(bot).not.toBeEmpty({ timeout: 9 * 60_000 })

      // The " tok/s" / " tokens" labels are static, so they're present before
      // generation finishes — they can't gate on the stats being ready. The
      // token count renders its `0` fallback until the `complete` message lands,
      // so poll the real number until it settles above zero.
      await expect
        .poll(async () => Number(await page.locator('.stats b').nth(1).innerText()), {
          timeout: 9 * 60_000,
        })
        .toBeGreaterThan(0)
    })

    const options = await ctx.newPage()
    await withPageErrorWatch(options, 'crystal settings page', async () => {
      await options.goto(`chrome-extension://${extId}/src/options/index.html`)
      await expect(options.getByRole('heading', { name: 'Crystal Settings' })).toBeVisible()
      await expect(options.getByText('Precision')).toBeVisible()
    })
  } finally {
    await ctx.close()
  }
})
