export function ThinkingBlock({ reasoning }: { reasoning: string }) {
  return (
    <details className="think">
      <summary>
        <span className="ch">▶</span> reasoning
      </summary>
      <div className="think-body">{reasoning}</div>
    </details>
  )
}
