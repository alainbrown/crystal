import { test, expect } from './fixtures'

// Drives the real UI against the real WebGPU engine: load → stream → done.
// The first run downloads model weights (~480 MB) and inference can be slow,
// so this is generously timed and meant for a WebGPU-capable machine.
test('streams a real reply in the side panel', async ({ context, extensionId }) => {
  test.setTimeout(10 * 60_000)
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)

  // Empty state before any conversation.
  await expect(page.getByText('Nothing leaves this device.')).toBeVisible()

  const input = page.getByPlaceholder("Share what's on your mind…")
  await input.fill('Reply with a short greeting.')
  await page.getByRole('button', { name: 'Send' }).click()

  // The user's message appears immediately.
  await expect(page.locator('.from-user')).toHaveText('Reply with a short greeting.')

  // The model loads (download card may appear) and then streams a non-empty
  // assistant reply. Allow plenty of time for first-run weight download.
  const bot = page.locator('.from-bot').last()
  await expect(bot).not.toBeEmpty({ timeout: 9 * 60_000 })

  // Telemetry reflects a completed generation.
  await expect(page.locator('.stats')).toContainText('tok/s')
  const tokens = await page.locator('.stats b').first().innerText()
  expect(Number(tokens)).toBeGreaterThan(0)
})

test('settings page renders without loading a model', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`)

  await expect(page.getByRole('heading', { name: 'Crystal Settings' })).toBeVisible()
  await expect(page.getByText('Precision')).toBeVisible()
  await expect(page.getByText('Qwen3.5 0.8B')).toBeVisible()
})
