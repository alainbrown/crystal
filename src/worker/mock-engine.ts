import type { ModelId } from '@/lib/models'
import type { ModelMessage } from '@/lib/chat'
import type { GenerateParams, LoadOptions } from './protocol'
import type {
  GenerateCallbacks,
  GenerateResult,
  LLMEngine,
  LoadCallbacks,
} from './engine'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export interface MockOptions {
  stepMs?: number
  chunks?: number
}

export class MockEngine implements LLMEngine {
  private interrupted = false
  private loaded = false
  private readonly stepMs: number
  private readonly chunks: number

  constructor(opts: MockOptions = {}) {
    this.stepMs = opts.stepMs ?? 6
    this.chunks = opts.chunks ?? 6
  }

  async load(_modelId: ModelId, _options: LoadOptions, cb: LoadCallbacks): Promise<void> {
    const total = 480 * 1024 * 1024
    for (let i = 1; i <= this.chunks; i++) {
      const loaded = Math.round((total * i) / this.chunks)
      cb.onProgress({
        file: 'onnx/model_q4.onnx',
        loaded,
        total,
        progress: i / this.chunks,
      })
      await sleep(this.stepMs)
    }
    this.loaded = true
  }

  async generate(
    messages: ModelMessage[],
    params: GenerateParams,
    cb: GenerateCallbacks,
  ): Promise<GenerateResult> {
    if (!this.loaded) throw new Error('Model not loaded')
    this.interrupted = false
    const started = Date.now()

    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    const reasoningText = params.reasoning
      ? `The user said: "${truncate(lastUser, 60)}". This is a mocked engine, so I'll reply briefly.`
      : ''
    const answerText =
      `You're running Crystal with a mocked model — everything stays on-device. ` +
      `You said: "${truncate(lastUser, 80)}".`

    let tokens = 0

    if (params.reasoning && reasoningText) {
      for (const tok of tokenize(reasoningText)) {
        if (this.interrupted) break
        cb.onToken(tok, 'reasoning')
        tokens++
        await sleep(this.stepMs)
      }
    }

    let answer = ''
    for (const tok of tokenize(answerText)) {
      if (this.interrupted) break
      cb.onToken(tok, 'answer')
      answer += tok
      tokens++
      if (tokens >= params.maxTokens) break
      await sleep(this.stepMs)
    }

    const elapsedMs = Math.max(1, Date.now() - started)
    return {
      answer: answer.trim(),
      reasoning: params.reasoning ? reasoningText : undefined,
      stats: {
        tokens,
        elapsedMs,
        tokensPerSec: +(tokens / (elapsedMs / 1000)).toFixed(1),
      },
    }
  }

  interrupt(): void {
    this.interrupted = true
  }

  dispose(): void {
    this.loaded = false
  }
}

function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? []
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
