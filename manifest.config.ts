import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

const HF_HOSTS = [
  'https://huggingface.co/*',
  'https://*.huggingface.co/*',
  'https://*.hf.co/*',
  'https://cdn-lfs.huggingface.co/*',
  'https://cdn-lfs-us-1.hf.co/*',
  'https://cdn-lfs-eu-1.hf.co/*',
  'https://cas-bridge.xethub.hf.co/*',
]

export default defineManifest({
  manifest_version: 3,
  name: 'Crystal',
  version: pkg.version,
  description: pkg.description,
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtXGtjtdObR7CoJjLgYQo0ZveZHxF+Ogxwyq21U6xfhie93yWjd18WWimmcryZP42zZArMcK6ASMaInJI6+XqtCShMn+m/n8Mv2BjFg2K6zFYHKltPXH+FwrLRzCcAfy4Ha2df9+1GCUauTUvt/ju73IMeTjVh3LeccTOl6hZ5r35wRTQnQ91/NRYbGEMxpUM7W2b8dUcPuBY/LS5FSMiIgotzIw0Lo/kPcxIWCviKO6k2dgXPRJCvQbkbFy/ek1m3zjFwsuc9C72jwucrVs00KBVeWbkh/a6P8ZQV+qxkQSh2l/eO26kkxGQkKXplG+y3DGzK9pL7hb7MhdOfxV7OwIDAQAB',
  icons: {
    '16': 'src/assets/icon-16.png',
    '48': 'src/assets/icon-48.png',
    '128': 'src/assets/icon-128.png',
  },
  action: {
    default_title: 'Open Crystal',
    default_icon: {
      '16': 'src/assets/icon-16.png',
      '48': 'src/assets/icon-48.png',
      '128': 'src/assets/icon-128.png',
    },
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  permissions: ['sidePanel', 'storage', 'activeTab', 'contextMenus'],
  host_permissions: HF_HOSTS,
  content_security_policy: {
    extension_pages:
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';",
  },
})
