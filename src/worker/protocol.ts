import type { ModelId } from '@/lib/models'
import type { ModelMessage } from '@/lib/chat'
import type { Precision } from '@/lib/settings'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error'

export interface LoadOptions {
  precision: Precision
  cpuFallback: boolean
}

export interface GenerateParams {
  temperature: number
  maxTokens: number
  reasoning: boolean
}

export interface FileProgress {
  file: string
  loaded: number
  total: number
  progress: number
}

// Coarse stages of a model load, surfaced so the UI can say *what kind* of waiting
// this is rather than one generic spinner. `checking` (deciding cache vs network),
// `downloading` (bytes off the Hub, determinate bar), `cache` (reading cached weights,
// no network), `compiling` (download done, building the graph / warming up WebGPU —
// the long, callback-less tail that otherwise reads as a freeze).
export type LoadPhase = 'checking' | 'downloading' | 'cache' | 'compiling'

export interface GenStats {
  tokens: number
  elapsedMs: number
  tokensPerSec: number
}

export type RequestMessage =
  | { type: 'load'; modelId: ModelId; options: LoadOptions }
  | { type: 'generate'; requestId: string; messages: ModelMessage[]; params: GenerateParams }
  | { type: 'interrupt' }
  | { type: 'dispose' }

export type ResponseMessage =
  | { type: 'status'; status: EngineStatus; detail?: string }
  | { type: 'phase'; phase: LoadPhase }
  | { type: 'progress'; data: FileProgress }
  | { type: 'ready'; modelId: ModelId }
  | { type: 'token'; requestId: string; token: string; kind: 'answer' | 'reasoning' }
  | {
      type: 'complete'
      requestId: string
      answer: string
      reasoning?: string
      stats: GenStats
    }
  | { type: 'error'; requestId?: string; message: string }

export const isResponse = (v: unknown): v is ResponseMessage =>
  !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string'
