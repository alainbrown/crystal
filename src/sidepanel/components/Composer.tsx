import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useChatStore } from '@/store/chat-store'
import { fileToDataURL, downscaleDataUrl, cropDataUrl } from '@/lib/images'
import { pdfToImages } from '@/lib/pdf'
import { subscribePendingCapture, takePendingCapture } from '@/lib/capture'

export function Composer({ value: controlledValue }: { value?: string } = {}) {
  const [localText, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  // `value`, when provided, drives the field from outside (the Remotion demo
  // types into it deterministically). Production renders <Composer/> with no
  // props, so behavior is unchanged.
  const text = controlledValue ?? localText
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const status = useChatStore((s) => s.status)
  const generating = status === 'generating'
  const canSend = (text.trim().length > 0 || images.length > 0) && !generating

  // A "Send screenshot to Crystal" context-menu click captures the tab in the service
  // worker and queues it; drain it here whether the panel was already open or the click
  // just opened it. Downscaled like uploaded files so captures share the size budget.
  useEffect(() => {
    let active = true
    async function drain() {
      const capture = await takePendingCapture()
      if (!capture) return
      const { url, rect } = capture
      // A region capture carries a box in CSS px; scale by dpr to the screenshot's own
      // pixels and crop. A plain screenshot is just downscaled like an upload.
      const small = rect
        ? await cropDataUrl(url, {
            x: rect.x * rect.dpr,
            y: rect.y * rect.dpr,
            width: rect.width * rect.dpr,
            height: rect.height * rect.dpr,
          })
        : await downscaleDataUrl(url)
      if (active) setImages((prev) => [...prev, small])
    }
    void drain()
    const unsubscribe = subscribePendingCapture(() => void drain())
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  function submit() {
    if (!canSend) return
    const pending = images
    setText('')
    setImages([])
    setNote('')
    void send(text, pending)
  }

  // A PDF has no image modality the model can read, so we rasterize its pages to images
  // (lib/pdf.ts) and treat them exactly like uploaded photos. Images are read directly.
  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // let the same file be re-picked after removal
    setNote('')
    try {
      const added: string[] = []
      const notes: string[] = []
      for (const file of picked) {
        if (file.type === 'application/pdf') {
          const { images: pages, totalPages, truncated } = await pdfToImages(file)
          added.push(...pages)
          if (truncated) notes.push(`${file.name}: added first ${pages.length} of ${totalPages} pages`)
        } else if (file.type.startsWith('image/')) {
          added.push(await fileToDataURL(file))
        }
      }
      if (added.length) setImages((prev) => [...prev, ...added])
      if (notes.length) setNote(notes.join(' · '))
    } catch (err) {
      setNote(err instanceof Error ? `Couldn't read that file: ${err.message}` : "Couldn't read that file")
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="composer">
      {note ? <div className="attach-note">{note}</div> : null}
      {images.length > 0 ? (
        <div className="attachments">
          {images.map((src, i) => (
            <div className="attach" key={i}>
              <img src={src} alt="" />
              <button
                className="attach-x"
                onClick={() => removeImage(i)}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="field">
        <button
          className="plusbtn"
          title="Attach image or PDF"
          aria-label="Attach image or PDF"
          onClick={() => fileRef.current?.click()}
        >
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={onPick}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Share what's on your mind…"
          rows={1}
        />
        <div className="actions">
          {generating ? (
            <button className="iconbtn stop" title="Stop" onClick={stop} aria-label="Stop">
              ⏹
            </button>
          ) : (
            <button
              className="iconbtn send"
              title="Send"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
