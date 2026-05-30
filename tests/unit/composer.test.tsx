import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Composer } from '@/sidepanel/components/Composer'
import { useChatStore, type ChatState } from '@/store/chat-store'

// The capture drain and the heavy image/pdf helpers depend on chrome/canvas/pdf.js,
// none of which exist in jsdom — mock them so the component's own logic is what's tested.
vi.mock('@/lib/capture', () => ({
  takePendingDrop: vi.fn(async () => null),
  subscribePendingDrop: vi.fn(() => () => {}),
}))
vi.mock('@/lib/images', () => ({
  MAX_IMAGE_EDGE: 1024,
  fileToDataURL: vi.fn(async () => 'data:img'),
  downscaleDataUrl: vi.fn(async (u: string) => u),
  cropDataUrl: vi.fn(async (u: string) => u),
}))
vi.mock('@/lib/pdf', () => ({
  pdfToImages: vi.fn(async () => ({ images: ['data:p1', 'data:p2'], totalPages: 2, truncated: false })),
}))

let send: ReturnType<typeof vi.fn>

beforeEach(() => {
  send = vi.fn()
  useChatStore.setState({ send: send as unknown as ChatState['send'], stop: vi.fn(), status: 'idle' })
})
afterEach(cleanup)

const placeholder = "Share what's on your mind…"

describe('Composer', () => {
  it('disables Send until there is text, then enables it', () => {
    render(<Composer />)
    const sendBtn = screen.getByRole('button', { name: 'Send' })
    expect(sendBtn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: 'hi' } })
    expect(sendBtn).not.toBeDisabled()
  })

  it('sends the text and clears the field', () => {
    render(<Composer />)
    const field = screen.getByPlaceholderText(placeholder)
    fireEvent.change(field, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(send).toHaveBeenCalledWith('hello', [], [])
    expect(field).toHaveValue('')
  })

  it('submits on Enter but not Shift+Enter', () => {
    render(<Composer />)
    const field = screen.getByPlaceholderText(placeholder)
    fireEvent.change(field, { target: { value: 'one' } })
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })
    expect(send).not.toHaveBeenCalled()
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('attaches a picked image and includes it on send', async () => {
    const { container } = render(<Composer />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(container.querySelector('.attach img')).toBeTruthy())
    // An image alone (no text) is enough to send.
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(send).toHaveBeenCalledWith('', ['data:img'], [])
  })

  it('rasterizes a picked PDF into one thumbnail per page', async () => {
    const { container } = render(<Composer />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [pdf] } })

    await waitFor(() => expect(container.querySelectorAll('.attach img')).toHaveLength(2))
  })

  it('removes a picked image with its ✕ button', async () => {
    const { container } = render(<Composer />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })

    await waitFor(() => expect(container.querySelector('.attach img')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(container.querySelector('.attach img')).toBeNull()
  })

  it('shows Stop instead of Send while generating', () => {
    useChatStore.setState({ status: 'generating' })
    render(<Composer />)
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
  })
})
