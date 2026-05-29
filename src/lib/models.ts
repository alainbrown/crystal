export type ModelId =
  | 'onnx-community/Qwen3.5-0.8B-ONNX-OPT'
  | 'onnx-community/Qwen3.5-2B-ONNX-OPT'
  | 'onnx-community/Qwen3.5-4B-ONNX-OPT'

export interface ModelInfo {
  id: ModelId
  label: string
  family: string
  icon: string
  approxDownloadMB: number
  /** The model's native context window, in tokens — the hard ceiling for input + output. */
  contextTokens: number
  blurb: string
}

// Qwen3.5 ships a 32K-token context window across every size in the family.
const QWEN35_CONTEXT = 32_768

export const MODELS: readonly ModelInfo[] = [
  {
    id: 'onnx-community/Qwen3.5-0.8B-ONNX-OPT',
    label: '0.8B',
    family: 'Qwen3.5',
    icon: '💎',
    approxDownloadMB: 480,
    contextTokens: QWEN35_CONTEXT,
    blurb: 'fastest · smallest',
  },
  {
    id: 'onnx-community/Qwen3.5-2B-ONNX-OPT',
    label: '2B',
    family: 'Qwen3.5',
    icon: '💠',
    approxDownloadMB: 1300,
    contextTokens: QWEN35_CONTEXT,
    blurb: 'balanced',
  },
  {
    id: 'onnx-community/Qwen3.5-4B-ONNX-OPT',
    label: '4B',
    family: 'Qwen3.5',
    icon: '🔷',
    approxDownloadMB: 2600,
    contextTokens: QWEN35_CONTEXT,
    blurb: 'sharpest · heavy',
  },
] as const

export const DEFAULT_MODEL_ID: ModelId = 'onnx-community/Qwen3.5-0.8B-ONNX-OPT'

export function getModel(id: ModelId): ModelInfo {
  const found = MODELS.find((m) => m.id === id)
  if (!found) throw new Error(`Unknown model: ${id}`)
  return found
}

export function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && MODELS.some((m) => m.id === value)
}

/** Human-readable download size, e.g. 480 → "480 MB", 1300 → "1.3 GB". */
export function formatSize(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`
}
