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
// side panel) and flows through the same attachment pipeline as photos. This verifies
// the rasterization, the CSP-safe bundled worker (a thrown worker/CSP error would trip
// withPageErrorWatch), and the bubble rendering — without waiting on model generation,
// which the main journey already covers, so no second weights download is needed.
test('attaching a PDF rasterizes its pages into image attachments', async () => {
  test.setTimeout(3 * 60_000)

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
        for (const k of await caches.keys()) await caches.delete(k)
      })
      await page.reload()

      // Attach the PDF through the hidden file input behind the + button.
      await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)

      // Our fixture is one page, so pdf.js should produce exactly one thumbnail chip.
      await expect(page.locator('.attachments .attach img')).toHaveCount(1)

      // Sending renders the rasterized page inside the user bubble immediately
      // (optimistic), independent of the model. The page image proves the PDF became
      // a real image attachment end to end.
      await page.getByPlaceholder("Share what's on your mind…").fill('What does this document say?')
      await page.getByRole('button', { name: 'Send' }).click()

      const bubble = page.locator('.from-user').last()
      await expect(bubble).toContainText('What does this document say?')
      await expect(bubble.locator('.bubble-images img')).toHaveCount(1)
    })
  } finally {
    await ctx.close()
  }
})
