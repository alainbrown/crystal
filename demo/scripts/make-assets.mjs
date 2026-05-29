// Generates Chrome Web Store + YouTube static assets from the panel shots.
// Run from demo/:  node scripts/make-assets.mjs
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(DIR, '..', 'out', 'cws')
mkdirSync(OUT, { recursive: true })

const asset = (p) => 'data:image/png;base64,' + readFileSync(path.join(DIR, '..', 'out', p)).toString('base64')
const svg = (p) => 'data:image/svg+xml;base64,' + readFileSync(path.join(DIR, '..', '..', p)).toString('base64')

const LOGO = svg('src/assets/logo.svg')
const SHOTS = {
  empty: asset('shot-empty.png'),
  stream: asset('shot-stream.png'),
  reason: asset('shot-reason.png'),
  dropdown: asset('shot-dropdown.png'),
  stats: asset('shot-stats.png'),
}

const BRAND_BG =
  'radial-gradient(120% 90% at 50% -10%, #8086ff 0%, rgba(128,134,255,0) 55%), linear-gradient(150deg, #6b72f0 0%, #5258d8 45%, #3f45b8 100%)'

const HEAD = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Nunito',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
    .frame { position:relative; overflow:hidden; color:#fff; background:${BRAND_BG}; display:flex; }
    .shot { border-radius:20px; box-shadow:0 30px 80px rgba(16,18,40,.5); display:block; }
    .eyebrow { display:inline-flex; align-items:center; gap:9px; font-weight:800; font-size:19px;
      letter-spacing:.3px; background:rgba(255,255,255,.16); padding:8px 15px; border-radius:30px; }
    .eyebrow img { width:22px; height:22px; border-radius:6px; }
    h1 { font-weight:900; letter-spacing:-1.2px; line-height:1.04; }
    p.sub { font-weight:600; opacity:.92; line-height:1.4; }
  </style>`

// Five marketing screenshots @1280x800: headline column + panel on the right.
const SCREENS = [
  { key: 'empty', h: 'Private AI,<br>right in your sidebar', s: 'A chat panel that lives in Chrome and runs entirely on your own machine.' },
  { key: 'stream', h: 'Runs 100%<br>on your device', s: 'Qwen3.5 streams answers in-browser via WebGPU — no server, no API key.' },
  { key: 'reason', h: 'Watch it<br>think', s: 'Crystal shows its reasoning, then its answer — all computed locally.' },
  { key: 'dropdown', h: 'Switch models<br>in a click', s: 'Pick 0.8B, 2B, or 4B — trade speed for smarts whenever you like.' },
  { key: 'stats', h: 'Nothing leaves<br>this device', s: 'Private by design. Your words never touch a network. They stay yours.' },
]

function screenshot({ h, s, key }) {
  return `<div class="frame" style="width:1280px;height:800px;align-items:center;padding:0 70px;gap:40px">
    <div style="flex:1">
      <span class="eyebrow"><img src="${LOGO}">Crystal</span>
      <h1 style="font-size:66px;margin:26px 0 22px">${h}</h1>
      <p class="sub" style="font-size:24px;max-width:520px">${s}</p>
    </div>
    <div style="flex:none;width:430px;display:flex;justify-content:center">
      <img class="shot" src="${SHOTS[key]}" style="width:430px">
    </div>
  </div>`
}

// Marquee promo tile 1400x560.
const marquee = `<div class="frame" style="width:1400px;height:560px;align-items:center;padding:0 80px;gap:50px">
  <div style="flex:1">
    <img src="${LOGO}" style="width:96px;height:96px;border-radius:24px;box-shadow:0 16px 40px rgba(0,0,0,.35)">
    <h1 style="font-size:82px;margin:26px 0 16px">Crystal</h1>
    <p class="sub" style="font-size:30px;max-width:620px">Private, on-device AI chat for Chrome.<br>No server. No API key. Just your GPU.</p>
  </div>
  <div style="flex:none;width:360px;display:flex;justify-content:center">
    <img class="shot" src="${SHOTS.reason}" style="width:360px">
  </div>
</div>`

// Small promo tile 440x280.
const smallTile = `<div class="frame" style="width:440px;height:280px;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center">
  <img src="${LOGO}" style="width:74px;height:74px;border-radius:18px;box-shadow:0 12px 30px rgba(0,0,0,.35)">
  <h1 style="font-size:40px;margin-top:4px">Crystal</h1>
  <p class="sub" style="font-size:17px;max-width:330px">Private, on-device AI for Chrome</p>
</div>`

// YouTube thumbnail 1280x720 — bold, legible at small size.
const thumb = `<div class="frame" style="width:1280px;height:720px;align-items:center;padding:0 72px;gap:30px">
  <div style="flex:1">
    <span class="eyebrow" style="font-size:22px"><img src="${LOGO}" style="width:26px;height:26px">Crystal</span>
    <h1 style="font-size:88px;margin:22px 0 18px">Private AI,<br>100% on-device</h1>
    <p class="sub" style="font-size:30px;font-weight:800;color:#dfe2ff">Qwen3.5 in your browser · no server, no API key</p>
  </div>
  <div style="flex:none;width:404px;display:flex;justify-content:center">
    <img class="shot" src="${SHOTS.stream}" style="width:404px;transform:rotate(2deg)">
  </div>
</div>`

const JOBS = [
  ...SCREENS.map((sc, i) => ({ name: `screenshot-${i + 1}-${sc.key}`, w: 1280, h: 800, html: screenshot(sc) })),
  { name: 'promo-marquee-1400x560', w: 1400, h: 560, html: marquee },
  { name: 'promo-small-440x280', w: 440, h: 280, html: smallTile },
  { name: 'youtube-thumb-1280x720', w: 1280, h: 720, html: thumb },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const j of JOBS) {
  await page.setViewportSize({ width: j.w, height: j.h })
  await page.setContent(`<!doctype html><html><head>${HEAD}</head><body>${j.html}</body></html>`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, `${j.name}.png`), clip: { x: 0, y: 0, width: j.w, height: j.h } })
  console.log('wrote', j.name)
}
await browser.close()
