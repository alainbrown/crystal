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
  permissions: ['sidePanel', 'storage', 'activeTab', 'contextMenus', 'scripting'],
  host_permissions: HF_HOSTS,
  content_security_policy: {
    extension_pages:
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';",
  },
})
