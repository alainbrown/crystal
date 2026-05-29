// The Qwen3.5 models Crystal can run, all in ONNX-OPT (q4) form on the HF Hub.
// Weights download on first use and are cached by the browser thereafter.

export type ModelId =
  | 'onnx-community/Qwen3.5-0.8B-ONNX-OPT'
  | 'onnx-community/Qwen3.5-2B-ONNX-OPT'
  | 'onnx-community/Qwen3.5-4B-ONNX-OPT'

export interface ModelInfo {
  id: ModelId
  /** Short label shown in the selector, e.g. "0.8B". */
  label: string
  family: string
  /** Approximate q4 download size in MB, for the progress/size UI. */
  approxDownloadMB: number
  blurb: string
}

export const MODELS: readonly ModelInfo[] = [
  {
    id: 'onnx-community/Qwen3.5-0.8B-ONNX-OPT',
    label: '0.8B',
    family: 'Qwen3.5',
    approxDownloadMB: 480,
    blurb: 'fastest · smallest',
  },
  {
    id: 'onnx-community/Qwen3.5-2B-ONNX-OPT',
    label: '2B',
    family: 'Qwen3.5',
    approxDownloadMB: 1300,
    blurb: 'balanced',
  },
  {
    id: 'onnx-community/Qwen3.5-4B-ONNX-OPT',
    label: '4B',
    family: 'Qwen3.5',
    approxDownloadMB: 2600,
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
