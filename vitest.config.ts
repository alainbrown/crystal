import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // `include` already reports untested files (0%) for the full-tree denominator.
      include: ['src/**/*.{ts,tsx}'],
      // Entrypoints and type-only files have nothing meaningful to cover.
      exclude: ['src/**/main.tsx', 'src/**/*.d.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
})
