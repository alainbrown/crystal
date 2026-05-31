import type { ModelId } from '@/lib/models'
import type { ModelMessage } from '@/lib/chat'
import type { FileProgress, GenStats, GenerateParams, LoadOptions, LoadPhase } from './protocol'

export interface LoadCallbacks {
  onProgress(p: FileProgress): void
  onPhase?(phase: LoadPhase): void
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
  interrupt(): void
  dispose(): void
}
