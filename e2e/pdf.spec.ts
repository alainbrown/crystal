import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { expect, test, withPageErrorWatch } from './fixtures'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const EXT_DIR = join(REPO_ROOT, 'dist')
const MANIFEST = join(EXT_DIR, 'manifest.json')
const SAMPLE_PDF = join(__dirname, 'fixtures', 'sample.pdf')

test.beforeAll(() => {
  if (!existsSync(MANIFEST)) {
    throw new Error(
      "Extension is not built. Run 'pnpm build' before 'pnpm exec playwright test', or use 'pnpm test:e2e'.",
    )
  }
})

// PDF-specific journey: a picked PDF is rasterized to page images by pdf.js (in the
// side panel) and fed to the real VL model as an image attachment. This verifies the
// rasterization, the CSP-safe bundled worker (a thrown worker/CSP error would trip
// withPageErrorWatch), the bubble rendering, and that the model actually accepts the
// rasterized page and answers. We assert a non-empty reply + token stats rather than
// specific words: the 0.8B model's OCR is too rough to make exact content reliable.
test('summarizes an attached PDF through the real model', async () => {
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
    await withPageErrorWatch(page, 'crystal pdf journey', async () => {
      await page.goto(`chrome-extension://${extId}/src/sidepanel/index.html`)

      await page.evaluate(async () => {
        await chrome.storage.local.clear()
        await chrome.storage.local.set({
          'crystal.settings': { temperature: 0, maxTokens: 64, reasoning: false },
        })
        for (const k of await caches.keys()) await caches.delete(k)
      })
      await page.reload()

      await expect(page.getByText('Warming up your model…')).toBeVisible()

      // Attach the PDF through the hidden file input behind the + button.
      await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)

      // Our fixture is one page, so pdf.js should produce exactly one thumbnail chip.
      await expect(page.locator('.attachments .attach img')).toHaveCount(1)

      await page.getByPlaceholder("Share what's on your mind…").fill('Summarize this document.')
      await page.getByRole('button', { name: 'Send' }).click()

      // The rasterized page renders in the user bubble immediately (optimistic),
      // proving the PDF became a real image attachment end to end.
      const bubble = page.locator('.from-user').last()
      await expect(bubble).toContainText('Summarize this document.')
      await expect(bubble.locator('.bubble-images img')).toHaveCount(1)

      // The model must accept the rasterized page and produce a reply.
      const bot = page.locator('.from-bot').last()
      await expect(bot).not.toBeEmpty({ timeout: 9 * 60_000 })

      // Token count renders its `0` fallback until the `complete` message lands, so poll
      // the real number until it settles above zero (mirrors the main journey).
      await expect
        .poll(async () => Number(await page.locator('.stats b').nth(1).innerText()), {
          timeout: 9 * 60_000,
        })
        .toBeGreaterThan(0)
    })
  } finally {
    await ctx.close()
  }
})
