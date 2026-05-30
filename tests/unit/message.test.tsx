import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Message } from '@/sidepanel/components/Message'
import type { ChatMessage } from '@/lib/chat'

function assistant(content: string): ChatMessage {
  return { id: 'a1', role: 'assistant', content, createdAt: 0 }
}

describe('Message markdown rendering', () => {
  it('renders assistant markdown as real elements', () => {
    const { container } = render(
      <Message message={assistant('# Title\n\nSome **bold** and `code`.\n\n- one\n- two')} />,
    )
    expect(container.querySelector('.md h1')?.textContent).toBe('Title')
    expect(container.querySelector('.md strong')?.textContent).toBe('bold')
    expect(container.querySelector('.md code')?.textContent).toBe('code')
    expect(container.querySelectorAll('.md li')).toHaveLength(2)
  })

  it('renders GFM tables', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |'
    const { container } = render(<Message message={assistant(md)} />)
    expect(container.querySelector('.md table')).toBeTruthy()
    expect(container.querySelectorAll('.md td')).toHaveLength(2)
  })

  it('opens links in a new tab safely', () => {
    const { container } = render(<Message message={assistant('[hi](https://example.com)')} />)
    const a = container.querySelector('.md a') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('https://example.com')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noreferrer')
  })

  it('does not pass raw HTML through (no script injection)', () => {
    const { container } = render(
      <Message message={assistant('hello <script>alert(1)</script> world')} />,
    )
    expect(container.querySelector('script')).toBeNull()
  })

  it('keeps user messages as plain text (no markdown)', () => {
    const msg: ChatMessage = { id: 'u1', role: 'user', content: '# not a heading', createdAt: 0 }
    const { container } = render(<Message message={msg} />)
    expect(container.querySelector('.md')).toBeNull()
    expect(container.querySelector('.from-user')?.textContent).toContain('# not a heading')
  })
})
