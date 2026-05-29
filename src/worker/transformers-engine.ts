import {
  streamText,
  wrapLanguageModel,
  extractReasoningMiddleware,
  type ModelMessage as AiMessage,
} from 'ai'
import {
  transformersJS,
  type TransformersJSLanguageModel,
  type TransformersJSModelSettings,
} from '@browser-ai/transformers-js'
import { env, type ProgressInfo } from '@huggingface/transformers'

import type { ModelId } from '@/lib/models'
import type { ModelMessage } from '@/lib/chat'
import type { Precision } from '@/lib/settings'
import type { GenerateParams, LoadOptions } from './protocol'
import type {
  GenerateCallbacks,
  GenerateResult,
  LLMEngine,
  LoadCallbacks,
} from './engine'

env.allowLocalModels = false
env.useBrowserCache = true

type DType = NonNullable<TransformersJSModelSettings['dtype']>

function dtypeFor(precision: Precision): DType {
  return {
    embed_tokens: precision,
    vision_encoder: 'fp16',
    decoder_model_merged: precision,
  } as DType
}

export class TransformersEngine implements LLMEngine {
  private model: TransformersJSLanguageModel | null = null
  private controller: AbortController | null = null
  private aborted = false

  async load(modelId: ModelId, options: LoadOptions, cb: LoadCallbacks): Promise<void> {
    const dtype = dtypeFor(options.precision)
    const devices: Array<'webgpu' | 'wasm'> = options.cpuFallback
      ? ['webgpu', 'wasm']
      : ['webgpu']

    const rawInitProgressCallback = (p: ProgressInfo) => {
      if (p.status === 'progress' && p.file && p.total) {
        cb.onProgress({
          file: p.file,
          loaded: p.loaded ?? 0,
          total: p.total,
          progress: (p.progress ?? 0) / 100,
        })
      }
    }

    let lastErr: unknown
    for (const device of devices) {
      try {
        const model = transformersJS(modelId, {
          device,
          dtype,
          // Qwen3.5 is multimodal: this routes input building through the
          // documented two-step path (apply_chat_template → text → processor(text)),
          // rather than the return_dict path that yields invalid inputs for this model.
          isVisionModel: true,
          rawInitProgressCallback,
        })
        await model.createSessionWithProgress()
        this.model = model
        return
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Failed to load model')
  }

  async generate(
    messages: ModelMessage[],
    params: GenerateParams,
    cb: GenerateCallbacks,
  ): Promise<GenerateResult> {
    if (!this.model) throw new Error('Model not loaded')
    this.aborted = false
    this.controller = new AbortController()

    // The framework separates reasoning from the answer. The Qwen3.5 chat template
    // opens the <think> block in the prompt itself, so the generated stream starts
    // mid-reasoning with no opening tag — hence startWithReasoning tracks `reasoning`.
    const wrapped = wrapLanguageModel({
      model: this.model,
      middleware: extractReasoningMiddleware({
        tagName: 'think',
        startWithReasoning: params.reasoning,
      }),
    })

    let reasoning = ''
    let answer = ''
    let tokens = 0
    let started = 0

    const result = streamText({
      model: wrapped,
      messages: messages as AiMessage[],
      temperature: params.temperature,
      maxOutputTokens: params.maxTokens,
      abortSignal: this.controller.signal,
      providerOptions: { 'transformers-js': { enableThinking: params.reasoning } },
    })

    try {
      for await (const part of result.fullStream) {
        if (part.type === 'reasoning-delta') {
          if (!started) started = Date.now()
          tokens++
          reasoning += part.text
          if (params.reasoning) cb.onToken(part.text, 'reasoning')
        } else if (part.type === 'text-delta') {
          if (!started) started = Date.now()
          tokens++
          answer += part.text
          cb.onToken(part.text, 'answer')
        } else if (part.type === 'error') {
          throw part.error
        }
      }
    } catch (err) {
      if (!this.aborted) throw err
    } finally {
      this.controller = null
    }

    const elapsedMs = Math.max(1, Date.now() - (started || Date.now()))
    return {
      answer: answer.trim(),
      reasoning: params.reasoning ? reasoning.trim() || undefined : undefined,
      stats: {
        tokens,
        elapsedMs,
        tokensPerSec: +(tokens / (elapsedMs / 1000)).toFixed(1),
      },
    }
  }

  interrupt(): void {
    this.aborted = true
    this.controller?.abort()
  }

  dispose(): void {
    this.interrupt()
    this.model = null
  }
}
