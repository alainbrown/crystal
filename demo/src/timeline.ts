import type { ChatMessage } from '@/lib/chat'
import type { GenStats } from '@/worker/protocol'
import type { EngineStatus } from '@/worker/protocol'
import type { ModelId } from '@/lib/models'

export const FPS = 30
export const DURATION = 720 // 24s

// ── Beat boundaries (frames @ 30fps) ───────────────────────────────────────
const TYPE_START = 70
const TYPE_FILL = 165 // typed text fully entered by here
const SEND = 178 // user message sent, composer cleared
const REASON_START = 198
const REASON_FILL = 300
const ANSWER_START = 300
const ANSWER_FILL = 452
const COMPLETE = 464 // streaming stops, stats appear
const DD_OPEN = 506
const DD_SWITCH = 558
const DD_CLOSE = 590
export const END_START = 612

// ── Scripted content ────────────────────────────────────────────────────────
const PROMPT = "I've had a rough week. Can we just talk for a bit?"
const REASONING =
  'User sounds drained. Lead with warmth, not advice — keep it short and let them set the pace.'
const ANSWER =
  "Of course — I'm right here, and nothing you say leaves this device. It's just the two of us. What's been weighing on you?"
const STATS: GenStats = { tokens: 412, elapsedMs: 10_840, tokensPerSec: 38 }

const MODEL_SMALL: ModelId = 'onnx-community/Qwen3.5-0.8B-ONNX-OPT'
const MODEL_BIG: ModelId = 'onnx-community/Qwen3.5-2B-ONNX-OPT'

export type CaptionId = 'sidebar' | 'type' | 'think' | 'models' | null

export interface CaptionSegment {
  id: Exclude<CaptionId, null>
  start: number
  end: number
}

// Drives the lower-third card. Kept in sync with the caption logic below.
export const CAPTIONS: CaptionSegment[] = [
  { id: 'sidebar', start: 0, end: 62 },
  { id: 'type', start: 70, end: 178 },
  { id: 'think', start: 198, end: 464 },
  { id: 'models', start: 506, end: 590 },
]

export interface Snapshot {
  messages: ChatMessage[]
  status: EngineStatus
  stats: GenStats | null
  modelId: ModelId
  typedText: string
  dropdownOpen: boolean
  detailsOpen: boolean
  caption: CaptionId
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Reveal a string proportionally over a frame window, on word-ish boundaries. */
function reveal(text: string, frame: number, start: number, end: number): string {
  const p = clamp01((frame - start) / (end - start))
  return text.slice(0, Math.round(text.length * p))
}

function user(content: string): ChatMessage {
  return { id: 'u1', role: 'user', content, createdAt: 0 }
}

function assistant(content: string, reasoning: string, streaming: boolean): ChatMessage {
  return { id: 'a1', role: 'assistant', content, reasoning: reasoning || undefined, streaming, createdAt: 0 }
}

export function snapshotAt(frame: number): Snapshot {
  const modelId = frame >= DD_SWITCH ? MODEL_BIG : MODEL_SMALL
  const dropdownOpen = frame >= DD_OPEN && frame < DD_CLOSE

  // Caption schedule (null between beats lets the card fade fully out).
  let caption: CaptionId = null
  if (frame < 60) caption = 'sidebar'
  else if (frame >= TYPE_START && frame < SEND) caption = 'type'
  else if (frame >= REASON_START && frame < COMPLETE) caption = 'think'
  else if (frame >= DD_OPEN && frame < DD_CLOSE) caption = 'models'

  // Before send: empty transcript, optional typed text in composer.
  if (frame < SEND) {
    const typedText = frame < TYPE_START ? '' : reveal(PROMPT, frame, TYPE_START, TYPE_FILL)
    return {
      messages: [],
      status: 'ready',
      stats: null,
      modelId,
      typedText,
      dropdownOpen,
      detailsOpen: false,
      caption,
    }
  }

  // After send: user message present; assistant streams, then completes.
  const streaming = frame < COMPLETE
  const reasoning = reveal(REASONING, frame, REASON_START, REASON_FILL)
  const content = frame < ANSWER_START ? '' : reveal(ANSWER, frame, ANSWER_START, ANSWER_FILL)
  const detailsOpen = frame >= REASON_START && frame < DD_OPEN

  return {
    messages: [user(PROMPT), assistant(streaming ? content : ANSWER, streaming ? reasoning : REASONING, streaming)],
    status: streaming ? 'generating' : 'ready',
    stats: streaming ? null : STATS,
    modelId,
    typedText: '',
    dropdownOpen,
    detailsOpen,
    caption,
  }
}
