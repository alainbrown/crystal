// Typed message protocol between the UI and the LLM web worker.

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
  /** 0..1 */
  progress: number
}

export interface GenStats {
  tokens: number
  elapsedMs: number
  tokensPerSec: number
}

/** UI → Worker */
export type RequestMessage =
  | { type: 'load'; modelId: ModelId; options: LoadOptions }
  | { type: 'generate'; requestId: string; messages: ModelMessage[]; params: GenerateParams }
  | { type: 'interrupt' }
  | { type: 'dispose' }

/** Worker → UI */
export type ResponseMessage =
  | { type: 'status'; status: EngineStatus; detail?: string }
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
