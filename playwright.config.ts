import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 10 * 60_000,
  expect: { timeout: 120_000 },
  use: {
    trace: 'retain-on-failure',
  },
})
