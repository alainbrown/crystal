import { defineConfig } from '@playwright/test'

// One real end-to-end journey against the real WebGPU engine (no mock),
// budgeted to ~2 minutes total. Needs a WebGPU-capable Chromium; the default
// 0.8B model downloads on first run (fastest with a warm cache).
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'on-first-retry',
  },
})
