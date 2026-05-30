import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// react-markdown builds a real React element tree — no dangerouslySetInnerHTML and no
// raw-HTML passthrough by default — so it's safe under the extension CSP with no
// sanitizer. GFM adds tables, fenced code, strikethrough, task lists, and autolinks.
const components: Components = {
  // Links open in a new tab; react-markdown already strips dangerous URL schemes.
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
