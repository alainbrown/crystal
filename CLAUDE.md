# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Crystal is a Chrome **Manifest V3** extension: a private, on-device AI chat side panel. A multimodal **Qwen3.5** model runs entirely in the browser via **WebGPU** (transformers.js + onnxruntime-web) — no server, no API key. Model weights download once from the Hugging Face Hub and are browser-cached. Two UI surfaces: the chat **side panel** and a full-tab **settings** page.

## Commands

- `pnpm install`
- `pnpm dev` — Vite + CRXJS with HMR. Load `dist/` via `chrome://extensions` → Developer mode → Load unpacked.
- `pnpm build` — `tsc -b && vite build`; outputs the unpacked extension to `dist/`.
- `pnpm typecheck` — `tsc -b --noEmit` across all tsconfig projects.
- `pnpm test` — Vitest unit tests (jsdom; no network or GPU).
- Single unit test: `pnpm exec vitest run tests/unit/store.test.ts` or `pnpm exec vitest run -t "partial name"`.
- `pnpm test:e2e` — builds, then runs the Playwright journey against the built `dist/`. Requires a WebGPU-capable Chromium and downloads ~480 MB of weights on first run.

## Architecture (the non-obvious parts)

**Inference runs in the background service worker** (`src/background/service-worker.ts`), not in a page/Web Worker. It static-imports transformers.js and owns a single `LLMEngine`. This split is load-bearing:

- The side panel and options pages are thin React UIs that never touch the model. They connect to the SW over a `chrome.runtime` port via `WorkerClient` (`src/lib/worker-client.ts`) and exchange the typed messages in `src/worker/protocol.ts` (`load`/`generate`/`interrupt`/`dispose` → `status`/`progress`/`ready`/`token`/`complete`/`error`). The SW serializes `load → generate`; `interrupt` bypasses the queue.
- `src/store/chat-store.ts` (Zustand) owns the client, turns streamed tokens into chat messages, and persists settings to `chrome.storage` (synced across surfaces via `subscribeSettings`). The store is transport-agnostic: unit tests inject a fake client through `__setClientFactory`, so store/engine logic is exercised without a browser.
- `src/worker/engine.ts` is the `LLMEngine` interface; `transformers-engine.ts` is the real WebGPU implementation, `mock-engine.ts` a deterministic test double (unit tests only).

**MV3 + WebGPU constraints — do not regress these:**

- In the engine, set **only** `env.allowLocalModels = false` (plus `useBrowserCache`). Do **not** set `env.backends.onnx.wasm.wasmPaths` (to an object or Vite `?url` assets), and do **not** run inference from a page Web Worker. Either path makes onnxruntime-web import its WebGPU glue via a `blob:` URL, which the extension CSP (`script-src 'self' 'wasm-unsafe-eval'`) blocks → "no available backend found [webgpu]" → the model never loads. Running in the service worker and letting transformers.js resolve ORT as same-origin assets is the canonical fix.
- The model is **multimodal** (Qwen3.5 VL). Build text-generation inputs the documented two-step way: `processor.apply_chat_template(messages, …)` returns a string, then `await processor(text)` produces the tensors. Passing `{ return_dict: true }` to `apply_chat_template` does not yield valid inputs for this model.
- Model **weights are data**, fetched at runtime from the HF Hub (allowed via `host_permissions`); they are not bundled.

Models are defined in `src/lib/models.ts` (default `onnx-community/Qwen3.5-0.8B-ONNX-OPT` ~480 MB; 2B/4B also selectable). Settings live in `src/lib/settings.ts` (precision, temperature, maxTokens, reasoning, cpuFallback) and persist to `chrome.storage.local`.

## Testing

- **Unit** (`tests/unit/`, Vitest + jsdom): pure logic and store wiring via the injected `MockEngine`. No network or GPU.
- **E2E** (`e2e/journey.spec.ts`, Playwright): loads the built extension, reads the extension id from the service worker, and drives the real WebGPU engine end-to-end (download → streamed reply → token stats) plus the settings page. Needs a real GPU, so CI runs it on `macos-14`; the Ubuntu `test` job is typecheck + unit + build only. The journey uses a fresh persistent profile — if you ever debug with a fixed profile path, Chrome may serve a stale cached service worker across runs.

## TypeScript layout

Project references: `tsconfig.app.json` (src + tests/unit), `tsconfig.node.json` (vite/manifest/playwright configs), `tsconfig.e2e.json` (e2e/). `pnpm typecheck` builds all three.
