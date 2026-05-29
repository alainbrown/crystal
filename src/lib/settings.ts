import { DEFAULT_MODEL_ID, isModelId, type ModelId } from './models'

export type Precision = 'q4' | 'q8' | 'fp16'
export type Theme = 'calm' | 'light' | 'dark'
export type TextSize = 'small' | 'medium' | 'large'

export interface Settings {
  modelId: ModelId
  temperature: number
  maxTokens: number
  reasoning: boolean
  stream: boolean
  precision: Precision
  cpuFallback: boolean
  rememberConversations: boolean
  theme: Theme
  textSize: TextSize
}

export const DEFAULT_SETTINGS: Settings = {
  modelId: DEFAULT_MODEL_ID,
  temperature: 0.7,
  maxTokens: 512,
  reasoning: true,
  stream: true,
  precision: 'q4',
  cpuFallback: false,
  rememberConversations: true,
  theme: 'calm',
  textSize: 'medium',
}

const STORAGE_KEY = 'crystal.settings'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local
}

let memory: Settings = { ...DEFAULT_SETTINGS }

export function normalize(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS }
  if (!raw || typeof raw !== 'object') return s
  const r = raw as Record<string, unknown>
  if (isModelId(r.modelId)) s.modelId = r.modelId
  if (typeof r.temperature === 'number') s.temperature = clamp(r.temperature, 0, 2)
  if (typeof r.maxTokens === 'number') s.maxTokens = clamp(Math.round(r.maxTokens), 16, 4096)
  if (typeof r.reasoning === 'boolean') s.reasoning = r.reasoning
  if (typeof r.stream === 'boolean') s.stream = r.stream
  if (r.precision === 'q4' || r.precision === 'q8' || r.precision === 'fp16') s.precision = r.precision
  if (typeof r.cpuFallback === 'boolean') s.cpuFallback = r.cpuFallback
  if (typeof r.rememberConversations === 'boolean') s.rememberConversations = r.rememberConversations
  if (r.theme === 'calm' || r.theme === 'light' || r.theme === 'dark') s.theme = r.theme
  if (r.textSize === 'small' || r.textSize === 'medium' || r.textSize === 'large') s.textSize = r.textSize
  return s
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export async function loadSettings(): Promise<Settings> {
  if (!hasChromeStorage()) return { ...memory }
  const data = await chrome.storage.local.get(STORAGE_KEY)
  return normalize(data[STORAGE_KEY])
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings()
  const next = normalize({ ...current, ...patch })
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: next })
  } else {
    memory = next
  }
  return next
}

export function subscribeSettings(cb: (s: Settings) => void): () => void {
  if (!hasChromeStorage() || !chrome.storage.onChanged) return () => {}
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      cb(normalize(changes[STORAGE_KEY].newValue))
    }
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}

export const __testing = {
  STORAGE_KEY,
  resetMemory: () => {
    memory = { ...DEFAULT_SETTINGS }
  },
}
