import { test, expect } from './fixtures'

// One real journey, budgeted to ~2 minutes:
// open side panel → onboard → model loads → adjust a setting → chat → response.
test('side panel: onboard, load, adjust setting, chat, get a real response', async ({
  context,
  extensionId,
}) => {
  // 1. Open the side panel. Opening it kicks off model loading in the background.
  const panel = await context.newPage()
  await panel.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)

  // 2. Onboarding: the empty/welcome state and the privacy assurance.
  await expect(panel.getByText('Nothing leaves this device.')).toBeVisible()
  await expect(panel.getByText(/running locally/i)).toBeVisible()

  // 3. Model load is underway — the download/warm-up card appears.
  await expect(panel.getByText(/Warming up your model/i)).toBeVisible({ timeout: 30_000 })

  // 4. Adjust a setting in the options tab (turn reasoning off → shorter, faster
  //    replies). This persists to chrome.storage and syncs to the panel live,
  //    while the model keeps loading in the background.
  const options = await context.newPage()
  await options.goto(`chrome-extension://${extensionId}/src/options/index.html`)
  await expect(options.getByRole('heading', { name: 'Crystal Settings' })).toBeVisible()
  const reasoning = options.getByRole('switch', { name: 'Reasoning mode' })
  await expect(reasoning).toHaveAttribute('aria-checked', 'true') // on by default
  await reasoning.click()
  await expect(reasoning).toHaveAttribute('aria-checked', 'false')
  await options.close()

  // 5. Chat: send a short prompt from the panel.
  await panel.bringToFront()
  await panel.getByPlaceholder("Share what's on your mind…").fill('Say hello in one word.')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.locator('.from-user')).toHaveText('Say hello in one word.')

  // 6. Render the real model response: the assistant bubble fills in and the
  //    token telemetry updates. Most of the time budget is the model load.
  const reply = panel.locator('.from-bot').last()
  await expect(reply).not.toBeEmpty({ timeout: 90_000 })
  await expect(panel.locator('.stats b').first()).not.toHaveText('—')
})
