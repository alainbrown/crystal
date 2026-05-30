import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { MAX_IMAGE_EDGE } from './images'

// Qwen VL — like every vision model — has no PDF input modality; it only takes pixels.
// The documented path (and Qwen's own cookbook) is to rasterize each page to an image
// and feed those. We do that here in the side panel, so a PDF becomes a list of image
// data URLs that flow through the exact same attachment pipeline as uploaded photos —
// the engine, protocol, and store never learn PDFs exist.

// Vite emits the worker as a same-origin asset; worker-src 'self' in the extension CSP
// allows it (unlike a blob: worker, which the CSP blocks).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Each rendered page is an image attachment that gets sent to the model and persisted
// with the conversation. Pages are token- and storage-heavy, so bound how many we take
// from one document; callers surface the cap so truncation isn't silent.
export const MAX_PDF_PAGES = 10
const JPEG_QUALITY = 0.85

export interface PdfRenderResult {
  images: string[]
  totalPages: number
  /** True when the document had more pages than MAX_PDF_PAGES and we rendered a prefix. */
  truncated: boolean
}

export async function pdfToImages(file: File, maxEdge = MAX_IMAGE_EDGE): Promise<PdfRenderResult> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  try {
    const totalPages = pdf.numPages
    const pages = Math.min(totalPages, MAX_PDF_PAGES)
    const images: string[] = []
    for (let n = 1; n <= pages; n++) {
      const page = await pdf.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(1, maxEdge / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      // v5 recommends handing pdf.js the canvas element and letting it own the 2D
      // context, rather than the legacy canvasContext parameter.
      await page.render({ canvas, viewport }).promise
      images.push(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    return { images, totalPages, truncated: totalPages > pages }
  } finally {
    void pdf.destroy()
  }
}
