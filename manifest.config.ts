import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

// Hosts the Hugging Face Hub serves model weights from. These are DATA fetches
// (allowed via connect-src + host_permissions), not remote code.
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
  permissions: ['sidePanel', 'storage'],
  host_permissions: HF_HOSTS,
  // MV3 forbids remote scripts. 'wasm-unsafe-eval' is required for the
  // onnxruntime WebAssembly backend; everything else stays 'self'. The ORT
  // wasm/mjs assets are bundled and loaded same-origin by the worker, so they
  // need no web_accessible_resources entry.
  content_security_policy: {
    extension_pages:
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';",
  },
})
