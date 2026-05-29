import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'
import pkg from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react(), crx({ manifest })],
  // transformers.js is large; raise the warning ceiling so the build stays quiet.
  build: {
    chunkSizeWarningLimit: 4096,
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    strictPort: true,
    // CRXJS uses a websocket for HMR inside the extension.
    hmr: { port: 5173 },
  },
})
