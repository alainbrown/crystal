import { test, expect } from './fixtures'

// Drives the real UI end-to-end against the mocked engine: load → stream → done.
test('streams a reply in the side panel', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)

  // Empty state before any conversation.
  await expect(page.getByText('Nothing leaves this device.')).toBeVisible()

  const input = page.getByPlaceholder("Share what's on your mind…")
  await input.fill('hello there')
  await page.getByRole('button', { name: 'Send' }).click()

  // The user's message appears immediately.
  await expect(page.locator('.from-user')).toHaveText('hello there')

  // The assistant streams a reply that echoes the prompt (mock behavior).
  const bot = page.locator('.from-bot').last()
  await expect(bot).toContainText('hello there', { timeout: 15_000 })

  // A collapsible reasoning block is present (reasoning on by default).
  await expect(page.locator('details.think')).toBeVisible()

  // Telemetry updates once generation completes.
  await expect(page.locator('.stats')).toContainText('tok/s')
})

test('opens settings via the gear and shows compute backend', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`)

  await expect(page.getByRole('heading', { name: 'Crystal Settings' })).toBeVisible()
  await expect(page.getByText('Precision')).toBeVisible()
  // The model section lists all three sizes.
  await expect(page.getByText('Qwen3.5 0.8B')).toBeVisible()
})
