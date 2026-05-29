# Crystal

A Chrome extension that adds a **private, on-device AI chat panel** to the browser. The
LLM runs **entirely in the browser via WebGPU** — no server, no API key, no data ever
leaves the machine. Powered by [🤗 transformers.js](https://github.com/huggingface/transformers.js)
running [Qwen3.5](https://huggingface.co/onnx-community) (ONNX-OPT, q4).

Built as a Manifest V3 extension: a chat **side panel** and a full-tab **settings** page.

## Quick start

```bash
pnpm install
pnpm build           # outputs the unpacked extension to dist/
```

Then load it in Chrome:

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Click the Crystal toolbar icon to open the side panel

On first use, Crystal downloads the model weights (~480 MB for the default 0.8B) from the
Hugging Face Hub. They're cached by the browser, so subsequent loads are fast. Generation
runs on your GPU via WebGPU.

> **Requires WebGPU.** Recent Chrome/Edge on a machine with a supported GPU. If WebGPU is
> unavailable, enable **CPU fallback** in Settings → Compute (much slower).

### Develop

```bash
pnpm dev             # Vite + CRXJS with HMR
```

Load the generated `dist/` as above; CRXJS hot-reloads the panel and options page on save.

## How it works

- **UI** — React, with the two screens ported from the approved neumorphic mocks. Styling
  is plain CSS (design tokens in `src/styles/tokens.css`); the Nunito font is bundled
  locally via `@fontsource/nunito` (no remote fonts).
- **Inference runs in a Web Worker** (`src/worker/llm.worker.ts`) so the panel never
  freezes during load or generation. The worker speaks a typed message protocol
  (`src/worker/protocol.ts`) and serializes load → generate, while `interrupt` bypasses the
  queue to stop a run.
- **Engine abstraction** (`src/worker/engine.ts`) has two implementations:
  - `TransformersEngine` — the real one (Qwen3.5 on WebGPU via transformers.js); the worker
    always uses this.
  - `MockEngine` — deterministic, no network/GPU; a **unit-test double only**.
- **State** — a Zustand store (`src/store/chat-store.ts`) owns the worker and turns streamed
  tokens into chat messages; settings persist to `chrome.storage` and sync across surfaces.

## Manifest V3 + WebGPU notes

MV3 **forbids remote `<script>`/ESM imports on extension pages**, so everything that is
*code* must be served from the extension itself:

- **The transformers.js library and the onnxruntime-web WASM runtime are bundled locally.**
  `onnxruntime-web` is a direct dependency (pinned to the version transformers.js uses); the
  engine imports its WASM/glue as Vite assets and overrides ORT's default remote-CDN fetch:

  ```ts
  import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
  import ortMjs  from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url'
  env.backends.onnx.wasm.wasmPaths = { wasm: ortWasm, mjs: ortMjs }
  ```

  The jsep build is a superset (WebGPU *and* WASM-CPU), so this one pair covers both the GPU
  path and the CPU-fallback setting. The files are emitted into `dist/assets/` and loaded
  same-origin by the worker.
- **The model weights are *data*** — fetched at runtime from the HF Hub (allowed via
  `connect-src` + `host_permissions`) and cached by the browser.
- CSP: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'`.

Distribution: unpacked / dev install. The remote-weight fetch is fine for self-distribution;
revisit before any Chrome Web Store submission.

## Models

Selectable in Settings (default **0.8B**):

| Model | Size |
| --- | --- |
| `onnx-community/Qwen3.5-0.8B-ONNX-OPT` | ~480 MB |
| `onnx-community/Qwen3.5-2B-ONNX-OPT` | ~1.3 GB |
| `onnx-community/Qwen3.5-4B-ONNX-OPT` | ~2.6 GB |

## Testing

```bash
pnpm test            # Vitest unit tests — no network or GPU
pnpm test:e2e        # builds dist/ and runs Playwright against the REAL WebGPU engine
```

Unit tests cover the pure logic (chat helpers, settings, the engine contract via a test-only
`MockEngine`, and store wiring) with no network or GPU.

The e2e suite loads the real extension build and drives the actual transformers.js/WebGPU
engine — **no mock**. It therefore needs a WebGPU-capable Chromium and downloads the model on
first run (slow), so it's meant to run locally on a real machine rather than in a GPU-less CI.
See "Known issues".

## Stack

Vite + [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin) + TypeScript + React + Zustand;
Web Worker inference (transformers.js / onnxruntime-web / WebGPU); plain CSS; Vitest +
Playwright. Package manager: pnpm.

## Project structure

```
manifest.config.ts        MV3 manifest (side panel, options, background, CSP)
vite.config.ts            Vite + CRXJS
src/
  background/             service worker (opens the side panel)
  sidepanel/             chat panel: index.html, App, components, css
  options/               full-tab settings: index.html, Options, controls, css
  worker/                llm.worker, protocol, engine + transformers/mock engines
  store/                 Zustand chat store
  lib/                   models, chat helpers, settings, worker client
  hooks/                 useSettings
  styles/tokens.css      shared neumorphic design tokens
  assets/                generated diamond icons
scripts/make-icons.mjs   regenerates the icons
tests/unit/              Vitest
tests/e2e/               Playwright (mock build)
mocks/                   original static design mocks
```

## Known issues

- The build emits a redundant ~23 MB `asyncify.wasm` that transformers.js references
  statically; it's never loaded at runtime (we point `wasmPaths` at the jsep build). Harmless
  dead weight in `dist/`; could be stripped with a small Vite plugin later.
- The Playwright e2e suite runs the **real** engine, so it needs a WebGPU-capable machine and
  a first-run model download — it is not expected to pass in a GPU-less/headless CI.
  Separately, MV3 service-worker registration under headless Chromium still needs work for the
  `extensionId` fixture to resolve there.
