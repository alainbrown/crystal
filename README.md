# Crystal

A Chrome extension that adds a **private, on-device AI chat panel** to the browser. The
LLM runs **entirely in the browser via WebGPU** — no server, no API key, no data ever
leaves the machine. Powered by [🤗 transformers.js](https://github.com/huggingface/transformers.js)
running [Qwen3.5](https://huggingface.co/onnx-community) (ONNX-OPT, q4).

Built as a Manifest V3 extension with a side-panel chat and a full-tab settings page.

## Status

Design phase complete. Two screens are mocked and approved (see [`mocks/`](./mocks)):

- **Chat panel** — 384px side panel (`mocks/mock-2-neumorphic.html`)
- **Settings** — full browser tab / options page (`mocks/mock-2-settings.html`)
- **Gallery** — `mocks/index.html` (open this to compare both)

Visual direction: **soft neumorphic ("Crystal")** — calm light palette, Nunito, layered
soft/inset shadows, lilac-indigo accent. Privacy framed as comfort.

Extension code is **not yet scaffolded** — the recommended stack and build plan are below.

## Recommended stack

| Concern | Choice | Why |
| --- | --- | --- |
| Build | **Vite + [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin)** | CRXJS handles MV3: multiple HTML entries (panel + options), the background service worker, manifest generation, and HMR inside the extension. Vanilla Vite can't. |
| Language | **TypeScript** | Types for transformers.js and the worker↔UI message protocol. |
| UI | **React** | Structure for streaming-token state and settings forms. |
| State | **Zustand** | Lightweight; no Redux needed. |
| Inference | **Web Worker** | Model load + `generate()` off the main thread so the panel never freezes (running inference on the main thread locks up the UI). Tokens streamed back via `postMessage`. |
| LLM | **`@huggingface/transformers@4.2.0`** | `Qwen3_5ForConditionalGeneration` + `AutoProcessor`, `device: "webgpu"`, dtype q4. |
| Styling | **Plain CSS (CSS variables / modules)** | Neumorphism relies on bespoke layered `box-shadow`s — awkward in Tailwind. Lift the mock CSS directly. |
| Unit tests | **Vitest** | The testable logic: worker message protocol, chat-history reducer, settings persistence, prompt formatting. |
| E2E tests | **Playwright** | UI flows with the unpacked extension loaded, running against a **mocked model** (real WebGPU inference is impractical in CI — large downloads, GPU, flaky headless WebGPU). |
| Package manager | **pnpm** | |

One-liner:

> **Vite + CRXJS + TypeScript + React + Zustand + a Web Worker (transformers.js/WebGPU) + plain CSS; Vitest for logic, Playwright for mocked-model UI flows.**

## Models

Selectable in-app (default **0.8B**); weights fetched from the HF Hub on first use and
browser-cached:

- `onnx-community/Qwen3.5-0.8B-ONNX-OPT` — ~480 MB
- `onnx-community/Qwen3.5-2B-ONNX-OPT` — ~1.3 GB
- `onnx-community/Qwen3.5-4B-ONNX-OPT` — ~2.6 GB

## Manifest V3 constraints (important)

MV3 **forbids remote `<script>`/ESM imports on extension pages**. So loading the library
from a CDN (`import ... from "https://cdn.jsdelivr.net/..."`) will not work. The plan
accounts for this:

- **Library is code → must be `'self'`.** `@huggingface/transformers` is bundled locally
  through Vite. The onnxruntime-web `.wasm`/`.mjs` files are copied into the package
  (`vite-plugin-static-copy`) and `env.backends.onnx.wasm.wasmPaths` is set to
  `chrome.runtime.getURL(...)`.
- **Weights are data → allowed remotely.** Model files are fetched at runtime via the HF
  Hub, permitted through `connect-src` + `host_permissions`, and cached by the browser.
- CSP for extension pages: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.

Distribution: unpacked / dev install for now (the remote-weight fetch is fine for
self-distribution; revisit before any Chrome Web Store submission).

## Build plan

1. **Scaffold** — pnpm + Vite/CRXJS/React/TS; manifest with the **side panel** (chat) and
   **options page** (settings) entries + a background service worker that opens the panel.
2. **Vendor the engine** — install `@huggingface/transformers@4.2.0`, copy ORT wasm
   locally, wire `wasmPaths` and `connect-src`/`host_permissions` for the HF Hub.
3. **LLM worker** — stub the worker behind a clean interface (load, generate, stop,
   progress) so the mocked-model tests have a target; then implement with
   `Qwen3_5ForConditionalGeneration`, `TextStreamer`, and `InterruptableStoppingCriteria`.
4. **UI** — port the two mock screens into React components, reusing the mock CSS. Wire
   model selector (0.8B default / 2B / 4B), download progress, streaming transcript,
   collapsible reasoning, Send/Stop composer, tokens/sec footer; settings tab persists to
   `chrome.storage`.
5. **Tests** — Vitest for logic/protocol; lean Playwright suite against the mocked model.

## Repo layout

```
mocks/                     approved design mocks (static HTML)
  index.html               gallery — open to compare both screens
  mock-2-neumorphic.html   chat panel (384px side panel)
  mock-2-settings.html     settings (full browser tab)
```

(Extension source will land alongside `mocks/` once scaffolded.)
