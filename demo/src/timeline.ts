import type { ChatMessage, PageContext } from '@/lib/chat'
import type { GenStats } from '@/worker/protocol'
import type { EngineStatus } from '@/worker/protocol'
import type { ModelId } from '@/lib/models'

export const FPS = 30
export const DURATION = 800 // ~26.7s

// ── Beat boundaries (frames @ 30fps) ───────────────────────────────────────
const CTX_IN = 64 // "Send page text" chip lands in the composer
const SHOT_IN = 120 // "Send screenshot" thumbnail lands beside it
const TYPE_START = 168
const TYPE_FILL = 236 // typed question fully entered by here
const SEND = 250 // user message sent, composer cleared
const REASON_START = 270
const REASON_FILL = 356
const ANSWER_START = 356
const ANSWER_FILL = 540
const COMPLETE = 556 // streaming stops, stats appear
const DD_OPEN = 596
const DD_SWITCH = 644
const DD_CLOSE = 678
export const END_START = 700

// ── Scripted content ────────────────────────────────────────────────────────
const PROMPT = 'Summarize this and read the chart for me.'
const REASONING =
  "They've sent the whole article plus a screenshot of the chart. Pull the thesis from the text, read the trend off the image, and keep it to a few tight bullets."
// Markdown — exercises the real react-markdown renderer (headings, bold, em, lists).
const ANSWER = `## Summary
On-device models just crossed the "good enough" line: **2B-class** models now match last year's cloud APIs for everyday chat — without the privacy cost.

## What the chart shows
- Local latency fell **~3×** as WebGPU matured
- Quality (MMLU) climbed **58 → 71**
- Cloud calls dropped to near-zero

Smaller, faster, and entirely *yours*.`
const STATS: GenStats = { tokens: 446, elapsedMs: 11_700, tokensPerSec: 38 }

const MODEL_SMALL: ModelId = 'onnx-community/Qwen3.5-0.8B-ONNX-OPT'
const MODEL_BIG: ModelId = 'onnx-community/Qwen3.5-2B-ONNX-OPT'

// Page pulled in via "Send page text" — shown as a 📄 chip on the composer and bubble.
const PAGE: PageContext = {
  title: 'The State of On-Device AI — 2026',
  url: 'https://research.example.org/on-device-ai-2026',
  text: '',
  words: 3_480,
  truncated: true,
}

// Stand-in for a captured screenshot: an inline SVG "chart" so the demo needs no
// real capture (and stays privacy-safe). Rendered through the same <img> path as
// a real downscaled screenshot attachment.
const CHART_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'>
  <rect width='320' height='200' fill='#ffffff'/>
  <text x='20' y='30' font-family='Nunito,sans-serif' font-size='16' font-weight='800' fill='#2a2f4a'>On-device quality (MMLU)</text>
  <g fill='#6b72f0'>
    <rect x='28' y='130' width='40' height='40' rx='6'/>
    <rect x='90' y='106' width='40' height='64' rx='6'/>
    <rect x='152' y='86' width='40' height='84' rx='6'/>
    <rect x='214' y='62' width='40' height='108' rx='6'/>
    <rect x='276' y='44' width='40' height='126' rx='6'/>
  </g>
  <line x1='20' y1='170' x2='312' y2='170' stroke='#d7dbe6' stroke-width='2'/>
</svg>`
const SHOT = 'data:image/svg+xml,' + encodeURIComponent(CHART_SVG)

export type CaptionId = 'sidebar' | 'page' | 'shot' | 'ask' | 'think' | 'models' | null

export interface CaptionSegment {
  id: Exclude<CaptionId, null>
  start: number
  end: number
}

// Drives the lower-third card. Kept in sync with the caption logic below.
export const CAPTIONS: CaptionSegment[] = [
  { id: 'sidebar', start: 0, end: 54 },
  { id: 'page', start: 64, end: 116 },
  { id: 'shot', start: 120, end: 164 },
  { id: 'ask', start: 168, end: 250 },
  { id: 'think', start: 270, end: 556 },
  { id: 'models', start: 596, end: 678 },
]

export interface Snapshot {
  messages: ChatMessage[]
  status: EngineStatus
  stats: GenStats | null
  modelId: ModelId
  typedText: string
  composerImages: string[]
  composerContexts: PageContext[]
  dropdownOpen: boolean
  detailsOpen: boolean
  caption: CaptionId
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Reveal a string proportionally over a frame window. */
function reveal(text: string, frame: number, start: number, end: number): string {
  const p = clamp01((frame - start) / (end - start))
  return text.slice(0, Math.round(text.length * p))
}

function user(content: string, extras: { images?: string[]; contexts?: PageContext[] } = {}): ChatMessage {
  return {
    id: 'u1',
    role: 'user',
    content,
    images: extras.images,
    contexts: extras.contexts,
    createdAt: 0,
  }
}

function assistant(content: string, reasoning: string, streaming: boolean): ChatMessage {
  return { id: 'a1', role: 'assistant', content, reasoning: reasoning || undefined, streaming, createdAt: 0 }
}

export function snapshotAt(frame: number): Snapshot {
  const modelId = frame >= DD_SWITCH ? MODEL_BIG : MODEL_SMALL
  const dropdownOpen = frame >= DD_OPEN && frame < DD_CLOSE

  // Caption schedule (null between beats lets the card fade fully out).
  let caption: CaptionId = null
  if (frame < 54) caption = 'sidebar'
  else if (frame >= CTX_IN && frame < SHOT_IN) caption = 'page'
  else if (frame >= SHOT_IN && frame < TYPE_START) caption = 'shot'
  else if (frame >= TYPE_START && frame < SEND) caption = 'ask'
  else if (frame >= REASON_START && frame < COMPLETE) caption = 'think'
  else if (frame >= DD_OPEN && frame < DD_CLOSE) caption = 'models'

  // Before send: empty transcript; capture chips and typed text accrue in the composer.
  if (frame < SEND) {
    const composerContexts = frame >= CTX_IN ? [PAGE] : []
    const composerImages = frame >= SHOT_IN ? [SHOT] : []
    const typedText = frame < TYPE_START ? '' : reveal(PROMPT, frame, TYPE_START, TYPE_FILL)
    return {
      messages: [],
      status: 'ready',
      stats: null,
      modelId,
      typedText,
      composerImages,
      composerContexts,
      dropdownOpen,
      detailsOpen: false,
      caption,
    }
  }

  // After send: user message (with the page chip + screenshot) present; assistant
  // streams reasoning then a markdown answer, then completes.
  const streaming = frame < COMPLETE
  const reasoning = reveal(REASONING, frame, REASON_START, REASON_FILL)
  const content = frame < ANSWER_START ? '' : reveal(ANSWER, frame, ANSWER_START, ANSWER_FILL)
  const detailsOpen = frame >= REASON_START && frame < DD_OPEN

  return {
    messages: [
      user(PROMPT, { images: [SHOT], contexts: [PAGE] }),
      assistant(streaming ? content : ANSWER, streaming ? reasoning : REASONING, streaming),
    ],
    status: streaming ? 'generating' : 'ready',
    stats: streaming ? null : STATS,
    modelId,
    typedText: '',
    composerImages: [],
    composerContexts: [],
    dropdownOpen,
    detailsOpen,
    caption,
  }
}
