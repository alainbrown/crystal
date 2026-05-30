import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useChatStore } from '@/store/chat-store'
import { fileToDataURL } from '@/lib/images'

export function Composer({ value: controlledValue }: { value?: string } = {}) {
  const [localText, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
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

  function submit() {
    if (!canSend) return
    const pending = images
    setText('')
    setImages([])
    void send(text, pending)
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    e.target.value = '' // let the same file be re-picked after removal
    const urls = await Promise.all(picked.map((f) => fileToDataURL(f)))
    setImages((prev) => [...prev, ...urls])
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
          title="Attach image"
          aria-label="Attach image"
          onClick={() => fileRef.current?.click()}
        >
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
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
