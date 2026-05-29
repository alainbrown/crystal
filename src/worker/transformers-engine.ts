import {
  AutoProcessor,
  Qwen3_5ForConditionalGeneration,
  TextStreamer,
  InterruptableStoppingCriteria,
  env,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers'

import type { ModelId } from '@/lib/models'
import type { ModelMessage } from '@/lib/chat'
import { cleanToken, splitReasoning } from '@/lib/chat'
import type { Precision } from '@/lib/settings'
import type { GenerateParams, LoadOptions } from './protocol'
import type {
  GenerateCallbacks,
  GenerateResult,
  LLMEngine,
  LoadCallbacks,
} from './engine'

import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url'

env.allowLocalModels = false
env.useBrowserCache = true
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = { wasm: ortWasm, mjs: ortMjs }
  env.backends.onnx.wasm.proxy = false
}

type DType = Record<string, Precision>

function dtypeFor(precision: Precision): DType {
  return {
    embed_tokens: precision,
    vision_encoder: 'fp16',
    decoder_model_merged: precision,
  }
}

export class TransformersEngine implements LLMEngine {
  private model: PreTrainedModel | null = null
  private processor: Processor | null = null
  private stopping = new InterruptableStoppingCriteria()

  async load(modelId: ModelId, options: LoadOptions, cb: LoadCallbacks): Promise<void> {
    const progress_callback = (p: {
      status: string
      file?: string
      loaded?: number
      total?: number
      progress?: number
    }) => {
      if (p.status === 'progress' && p.file && p.total) {
        cb.onProgress({
          file: p.file,
          loaded: p.loaded ?? 0,
          total: p.total,
          progress: (p.progress ?? 0) / 100,
        })
      }
    }

    this.processor = (await AutoProcessor.from_pretrained(modelId, {
      progress_callback,
    })) as Processor

    const dtype = dtypeFor(options.precision)
    const devices: Array<'webgpu' | 'wasm'> = options.cpuFallback
      ? ['webgpu', 'wasm']
      : ['webgpu']

    let lastErr: unknown
    for (const device of devices) {
      try {
        this.model = await Qwen3_5ForConditionalGeneration.from_pretrained(modelId, {
          dtype,
          device,
          progress_callback,
        })
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
    if (!this.model || !this.processor) throw new Error('Model not loaded')
    this.stopping.reset()

    const processor = this.processor as unknown as {
      tokenizer: ConstructorParameters<typeof TextStreamer>[0]
      apply_chat_template: (
        messages: ModelMessage[],
        opts: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>
    }

    let raw = ''
    let emittedReasoning = 0
    let emittedAnswer = 0
    let started = 0
    let tokens = 0

    const streamer = new TextStreamer(processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: !params.reasoning,
      token_callback_function: () => {
        if (!started) started = Date.now()
        tokens++
      },
      callback_function: (text: string) => {
        raw += cleanToken(text)
        const { reasoning = '', answer } = splitReasoning(raw)
        if (params.reasoning && reasoning.length > emittedReasoning) {
          cb.onToken(reasoning.slice(emittedReasoning), 'reasoning')
          emittedReasoning = reasoning.length
        }
        if (answer.length > emittedAnswer) {
          cb.onToken(answer.slice(emittedAnswer), 'answer')
          emittedAnswer = answer.length
        }
      },
    })

    const inputs = await processor.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
      enable_thinking: params.reasoning,
    })

    await this.model.generate({
      ...inputs,
      max_new_tokens: params.maxTokens,
      do_sample: params.temperature > 0,
      temperature: params.temperature,
      streamer,
      stopping_criteria: this.stopping,
      return_dict_in_generate: true,
    } as Parameters<PreTrainedModel['generate']>[0])

    const { reasoning, answer } = splitReasoning(raw)
    const elapsedMs = Math.max(1, Date.now() - (started || Date.now()))
    return {
      answer: answer.trim(),
      reasoning: params.reasoning ? reasoning?.trim() || undefined : undefined,
      stats: {
        tokens,
        elapsedMs,
        tokensPerSec: +(tokens / (elapsedMs / 1000)).toFixed(1),
      },
    }
  }

  interrupt(): void {
    this.stopping.interrupt()
  }

  dispose(): void {
    this.model?.dispose?.()
    this.model = null
    this.processor = null
  }
}
