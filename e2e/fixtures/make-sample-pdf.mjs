// Generates e2e/fixtures/sample.pdf — a tiny, single-page PDF used by the PDF
// attachment e2e. The document is authored from scratch here (a few drawing
// operators on a blank page), so it carries no third-party content and is free
// to use. Re-run with `node e2e/fixtures/make-sample-pdf.mjs` if you tweak it.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const stream = 'BT /F1 24 Tf 36 96 Td (Crystal PDF fixture) Tj 0 -40 Td (single test page) Tj ET'
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 160] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
]

let pdf = '%PDF-1.4\n'
const offsets = []
objects.forEach((body, i) => {
  offsets[i] = pdf.length
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
})

const xrefStart = pdf.length
pdf += `xref\n0 ${objects.length + 1}\n`
pdf += '0000000000 65535 f \n' // each xref entry is exactly 20 bytes
for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

// latin1 keeps one byte per char so the xref offsets (computed from string length) stay valid.
writeFileSync(join(here, 'sample.pdf'), pdf, 'latin1')
console.log(`wrote sample.pdf (${pdf.length} bytes)`)
