import { defineConfig } from '@playwright/test'

// E2E runs against the built unpacked extension with a MOCKED model
// (real WebGPU inference is impractical in CI). See tests/e2e/fixtures.ts.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
})
