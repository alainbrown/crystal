# Crystal — demo & store assets

A [Remotion](https://www.remotion.dev/) project that renders Crystal's promo video,
README GIF, and Chrome Web Store / YouTube imagery. It drives the **real extension
React components** (not redrawn mockups) so the demo always matches the shipping UI.

## How it works

The model can't run in a headless render (no WebGPU, and inference lives in the
service worker), so the demo drives the UI deterministically instead:

- `src/Panel.tsx` mounts the production `Transcript`, `Message`, `ThinkingBlock`,
  `StatsBar`, and `Dropdown`, fed by the real `useChatStore` (Zustand).
- `src/timeline.ts` is the single source of truth: it maps every frame to an absolute
  UI snapshot (typed text, streamed tokens, reasoning, model selection). Because each
  frame sets an absolute state — never an increment — scrubbing and parallel rendering
  stay correct.
- `src/chrome-shim.ts` provides inert `chrome.*` no-ops so the extension modules load.
- Deps resolve from the repo-root `node_modules` (via `demo/package.json` + the webpack
  alias in `remotion.config.ts`), guaranteeing a **single React instance** — required
  for the real components' hooks to work.

A few tiny, backwards-compatible seams were added to the extension so their internal
state can be driven on cue (production renders them with no props → unchanged):
`Composer` accepts optional `value` / `images` / `contexts` (to script the typed text
plus "Send screenshot" and "Send page text" attachments), and `Dropdown` an optional `open`.

## Commands

Run from this `demo/` directory.

```bash
pnpm --dir .. install        # if you haven't already (installs Remotion at the root)

npm run studio               # interactive preview at http://localhost:3000
npm run render:mp4           # → out/crystal-demo.mp4   (1920×1080, ~27s)
npm run render:gif           # → out/crystal-demo.gif   (looping, 960×540)

# Marketing stills (panel-only "Shot" composition) + composited store assets:
npx remotion still src/index.ts Shot out/shot-stream.png --frame=520
node scripts/make-assets.mjs # → out/cws/*.png  (screenshots, marquee, tiles, thumb)
```

### Render in Docker (reproducible)

Renders both the MP4 and GIF in a clean Linux container with Chrome Headless Shell:

```bash
docker compose -f docker-compose.yml run --rm render   # outputs to demo/out/
```

## Deliverables (`store-assets/`)

| File | Use |
|------|-----|
| `crystal-demo.mp4` | YouTube upload (1920×1080) |
| `crystal-demo.gif` | README embed (960×540, looping) |
| `youtube-thumb-1280x720.png` | YouTube thumbnail |
| `screenshot-1..5-*.png` | Chrome Web Store screenshots (1280×800) |
| `promo-marquee-1400x560.png` | CWS marquee promo tile |
| `promo-small-440x280.png` | CWS small promo tile |

`out/` holds render scratch and is gitignored; the curated files above are committed.
