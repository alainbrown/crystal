import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src', 'assets')
mkdirSync(outDir, { recursive: true })

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}
function draw(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const c = (size - 1) / 2
  const tileR = size * 0.22
  const diamond = size * 0.3
  const top = [0x9b, 0x8c, 0xf0]
  const bot = [0x6f, 0x76, 0xf5]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = Math.max(tileR - x, x - (size - 1 - tileR), 0)
      const dy = Math.max(tileR - y, y - (size - 1 - tileR), 0)
      const inTile = Math.hypot(dx, dy) <= tileR + 0.5
      if (!inTile) {
        rgba[i + 3] = 0
        continue
      }
      const t = y / (size - 1)
      let r = lerp(top[0], bot[0], t)
      let g = lerp(top[1], bot[1], t)
      let b = lerp(top[2], bot[2], t)
      const d = Math.abs(x - c) / diamond + Math.abs(y - c) / diamond
      if (d <= 1) {
        const k = Math.min(1, (1 - d) * 4)
        r = lerp(r, 255, k)
        g = lerp(g, 255, k)
        b = lerp(b, 255, k)
      }
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = 255
    }
  }
  return encodePng(size, size, rgba)
}

for (const size of [16, 48, 128]) {
  const file = join(outDir, `icon-${size}.png`)
  writeFileSync(file, draw(size))
  console.log(`  ✓ icon-${size}.png`)
}
console.log(`\nIcons written → src/assets/`)
