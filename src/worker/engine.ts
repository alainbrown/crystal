// The engine abstraction. The real implementation wraps transformers.js;
// a mock implementation drives tests and the dev preview without downloads.

import type { ModelId } from '@/lib/models'
import type { ModelMessage } from '@/lib/chat'
import type { FileProgress, GenStats, GenerateParams, LoadOptions } from './protocol'

export interface LoadCallbacks {
  onProgress(p: FileProgress): void
}

export interface GenerateCallbacks {
  onToken(token: string, kind: 'answer' | 'reasoning'): void
}

export interface GenerateResult {
  answer: string
  reasoning?: string
  stats: GenStats
}

export interface LLMEngine {
  load(modelId: ModelId, options: LoadOptions, cb: LoadCallbacks): Promise<void>
  generate(
    messages: ModelMessage[],
    params: GenerateParams,
    cb: GenerateCallbacks,
  ): Promise<GenerateResult>
  /** Request that an in-flight generation stop at the next token. */
  interrupt(): void
  dispose(): void
}
