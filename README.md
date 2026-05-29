# Crystal

A private, on-device AI chat panel for Chrome. A multimodal **Qwen3.5** model runs
entirely in your browser via **WebGPU** — no server, no API key, no data leaving your
machine. Model weights download once from the Hugging Face Hub and are cached by the
browser.

Crystal is a Chrome **Manifest V3** extension with two surfaces: a chat **side panel**
and a full-tab **settings** page.

## How it works

Inference runs in the extension's **background service worker**, which owns a single
`LLMEngine` backed by [transformers.js](https://github.com/huggingface/transformers.js)
and onnxruntime-web. The UI surfaces are thin React apps that never touch the model —
they talk to the service worker over a `chrome.runtime` port and exchange typed
messages (`load` / `generate` / `interrupt` / `dispose` → `status` / `progress` /
`ready` / `token` / `complete` / `error`).

```
side panel  ─┐
             ├─ chrome.runtime port ─→  service worker  ─→  LLMEngine (WebGPU)
settings    ─┘                                              transformers.js + ORT
```

Running inference in the service worker (rather than a page or Web Worker) is what lets
onnxruntime-web resolve its WebGPU backend as same-origin assets — the only arrangement
that satisfies the strict MV3 extension CSP.

## Models

Selectable in settings; the weights are fetched at runtime from the HF Hub.

| Model | Download | Notes |
| ----- | -------- | ----- |
| Qwen3.5 **0.8B** (default) | ~480 MB | fastest · smallest |
| Qwen3.5 **2B** | ~1.3 GB | balanced |
| Qwen3.5 **4B** | ~2.6 GB | sharpest · heavy |

Settings (precision, temperature, max tokens, reasoning, CPU fallback, theme, and more)
persist to `chrome.storage.local` and stay synced across both surfaces.

## Requirements

- A WebGPU-capable Chromium browser (Chrome / Edge, recent version).
- [pnpm](https://pnpm.io/).

## Getting started

```bash
pnpm install
pnpm dev          # Vite + CRXJS dev server with HMR
```

Then load the extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` directory.
4. Open the side panel from the Crystal toolbar icon.

The first chat triggers a one-time model download; subsequent loads use the browser
cache.

## Commands

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` | Vite + CRXJS dev server with HMR. |
| `pnpm build` | `tsc -b && vite build` → unpacked extension in `dist/`. |
| `pnpm typecheck` | `tsc -b --noEmit` across all tsconfig projects. |
| `pnpm test` | Vitest unit tests (jsdom; no network or GPU). |
| `pnpm test:e2e` | Builds, then runs the Playwright journey against the built `dist/`. |

Run a single unit test:

```bash
pnpm exec vitest run tests/unit/store.test.ts
pnpm exec vitest run -t "partial name"
```

## Testing

- **Unit** (`tests/unit/`, Vitest + jsdom) — pure logic and store wiring exercised
  through an injected `MockEngine`. No network or GPU. The store is transport-agnostic,
  so the client is faked via `__setClientFactory`.
- **E2E** (`e2e/journey.spec.ts`, Playwright) — loads the built extension and drives the
  real WebGPU engine end to end: model download → streamed reply → token stats, plus the
  settings page. Needs a real GPU and downloads ~480 MB of weights on first run.

## Project layout

```
src/
  background/service-worker.ts   single LLMEngine; owns inference
  worker/
    engine.ts                    LLMEngine interface
    transformers-engine.ts       real WebGPU implementation
    mock-engine.ts               deterministic test double
    protocol.ts                  typed port messages
  lib/
    worker-client.ts             port client used by the UI
    models.ts                    model catalog
    settings.ts                  settings schema + chrome.storage persistence
    chat.ts                      chat message helpers
  store/chat-store.ts            Zustand store; tokens → chat messages
  sidepanel/                     chat side-panel React UI
  options/                       settings-page React UI
e2e/                             Playwright journey
tests/unit/                      Vitest unit tests
```

TypeScript uses project references: `tsconfig.app.json` (src + unit tests),
`tsconfig.node.json` (build configs), and `tsconfig.e2e.json` (e2e). `pnpm typecheck`
builds all three.

## Privacy

Everything runs locally. The only network traffic is the one-time model-weight download
from the Hugging Face Hub (allowed via the extension's `host_permissions`). Your
conversations never leave the browser.
