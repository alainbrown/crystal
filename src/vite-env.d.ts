/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_LLM_ENGINE?: 'mock' | 'real'
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
