import {
  env,
  AutoProcessor,
  AutoModelForImageTextToText,
  RawImage,
  TextStreamer,
  StoppingCriteriaList,
  InterruptableStoppingCriteria,
  type ProgressInfo,
  type Processor,
  type PreTrainedModel,
} from '@huggingface/transformers'

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

// Anti-loop default. transformers.js applies this during generation; without it small
// models loop (Qwen's recommended range is ~1.05–1.15). Not user-configurable yet.
const REPETITION_PENALTY = 1.1

const CLOSE_THINK = '</think>'

// The chat template only needs to know an image is *present* (it emits a placeholder
// token); the pixels are handed to the processor separately. Split our ModelMessages
// into the template shape plus the ordered list of decoded images. Order matters: the
// Nth placeholder in the rendered text binds to the Nth image passed to processor().
type TemplatePart = { type: 'image' } | { type: 'text'; text: string }
type TemplateMessage = { role: string; content: string | TemplatePart[] }

async function prepareInputs(
  messages: ModelMessage[],
): Promise<{ templateMessages: TemplateMessage[]; images: RawImage[] }> {
  const images: RawImage[] = []
  const templateMessages: TemplateMessage[] = []
  for (const m of messages) {
    if (typeof m.content === 'string') {
      templateMessages.push({ role: m.role, content: m.content })
      continue
    }
    const parts: TemplatePart[] = []
    for (const part of m.content) {
      if (part.type === 'image') {
        images.push(await RawImage.read(part.image)) // data URLs fetch fine in the SW
        parts.push({ type: 'image' })
      } else {
        parts.push({ type: 'text', text: part.text })
      }
    }
    templateMessages.push({ role: m.role, content: parts })
  }
  return { templateMessages, images }
}

type DTypeMap = Record<'embed_tokens' | 'vision_encoder' | 'decoder_model_merged', Precision | 'fp16'>

function dtypeFor(precision: Precision): DTypeMap {
  return {
    embed_tokens: precision,
    vision_encoder: 'fp16',
    decoder_model_merged: precision,
  }
}

// We talk to transformers.js directly rather than through an AI SDK provider: the
// community adapter dropped two options the Qwen3.5 template/engine need — it never
// forwarded enable_thinking:false (so "reasoning off" still produced, and leaked, a
// think block) nor repetition_penalty (so small models looped). Both are set below.
export class TransformersEngine implements LLMEngine {
  private model: PreTrainedModel | null = null
  private processor: Processor | null = null
  private readonly stopper = new InterruptableStoppingCriteria()
  private aborted = false

  async load(modelId: ModelId, options: LoadOptions, cb: LoadCallbacks): Promise<void> {
    const dtype = dtypeFor(options.precision)
    const devices: Array<'webgpu' | 'wasm'> = options.cpuFallback
      ? ['webgpu', 'wasm']
      : ['webgpu']

    const progress_callback = (p: ProgressInfo) => {
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
        // Qwen3.5 is a multimodal (VL) model: load the image-text-to-text model plus its
        // processor. The processor's two-step path (apply_chat_template → string →
        // processor(text[, images])) is the documented way to build valid inputs — text
        // and, when the user attaches them, images. Running in the service worker lets
        // onnxruntime-web resolve its WebGPU backend as same-origin assets (no blob:
        // worker → CSP-safe).
        const [processor, model] = await Promise.all([
          AutoProcessor.from_pretrained(modelId, { progress_callback }),
          AutoModelForImageTextToText.from_pretrained(modelId, {
            dtype,
            device,
            progress_callback,
          } as Parameters<typeof AutoModelForImageTextToText.from_pretrained>[1]),
        ])
        this.processor = processor
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
    const { model, processor } = this
    if (!model || !processor) throw new Error('Model not loaded')
    const tokenizer = processor.tokenizer
    if (!tokenizer) throw new Error('Processor has no tokenizer')

    this.aborted = false
    this.stopper.reset()

    // enable_thinking drives the Qwen3.5 template: true pre-opens <think> (the model
    // reasons, emits </think>, then answers); false emits a pre-closed <think></think>
    // so the model answers directly with no reasoning.
    const { templateMessages, images } = await prepareInputs(messages)
    const text = processor.apply_chat_template(
      templateMessages as Parameters<Processor['apply_chat_template']>[0],
      {
        add_generation_prompt: true,
        enable_thinking: params.reasoning,
      } as Parameters<Processor['apply_chat_template']>[1],
    ) as string
    // Pass decoded images only when present; text-only turns keep the original
    // single-argument path the model has always used.
    const inputs = images.length ? await processor(text, images) : await processor(text)

    let reasoning = ''
    let answer = ''
    let tokens = 0
    let started = 0

    // Split reasoning from answer. With thinking on, the prompt pre-opened <think>, so
    // the generated stream starts mid-reasoning; everything up to the first </think> is
    // reasoning, the rest is the answer. With thinking off, the whole stream is answer.
    // `carry` holds back a possible </think> straddling a chunk boundary.
    let mode: 'reasoning' | 'answer' = params.reasoning ? 'reasoning' : 'answer'
    let carry = ''

    const emit = (chunk: string) => {
      if (mode === 'answer') {
        answer += chunk
        cb.onToken(chunk, 'answer')
        return
      }
      carry += chunk
      const idx = carry.indexOf(CLOSE_THINK)
      if (idx === -1) {
        const safe = carry.length - (CLOSE_THINK.length - 1)
        if (safe > 0) {
          const out = carry.slice(0, safe)
          carry = carry.slice(safe)
          reasoning += out
          if (params.reasoning) cb.onToken(out, 'reasoning')
        }
        return
      }
      const before = carry.slice(0, idx)
      const after = carry.slice(idx + CLOSE_THINK.length)
      if (before) {
        reasoning += before
        if (params.reasoning) cb.onToken(before, 'reasoning')
      }
      mode = 'answer'
      carry = ''
      if (after) {
        answer += after
        cb.onToken(after, 'answer')
      }
    }

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (t: string) => {
        if (this.aborted || !t) return
        if (!started) started = Date.now()
        tokens++
        emit(t)
      },
    })

    const stopping_criteria = new StoppingCriteriaList()
    stopping_criteria.extend([this.stopper])

    try {
      await model.generate({
        ...inputs,
        max_new_tokens: params.maxTokens,
        temperature: params.temperature,
        do_sample: params.temperature > 0,
        repetition_penalty: REPETITION_PENALTY,
        streamer,
        stopping_criteria,
        return_dict_in_generate: true,
      } as Parameters<PreTrainedModel['generate']>[0])
    } catch (err) {
      if (!this.aborted) throw err
    }

    // No closing tag ever arrived (e.g. the model never left the think block): flush
    // whatever is still buffered so it isn't silently dropped.
    if (mode === 'reasoning' && carry) {
      reasoning += carry
      if (params.reasoning) cb.onToken(carry, 'reasoning')
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
    this.stopper.interrupt()
  }

  dispose(): void {
    this.interrupt()
    void this.model?.dispose()
    this.model = null
    this.processor = null
  }
}
