import type { ReactNode } from 'react'

export function Section({
  id,
  icon,
  title,
  subtitle,
  children,
}: {
  id: string
  icon: string
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="section soft">
      <div className="sec-head">
        <span className="ic">{icon}</span>
        <h2>{title}</h2>
      </div>
      {subtitle ? <p className="sec-sub">{subtitle}</p> : null}
      {children}
    </section>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  desc?: string
}) {
  return (
    <div className="row">
      <div>
        <div className="label">{label}</div>
        {desc ? <div className="desc">{desc}</div> : null}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </div>
  )
}

export interface SegOption<T extends string> {
  value: T
  label: string
  blurb?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: SegOption<T>[]
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div className="row" style={{ display: 'block' }}>
      {label ? <div className="label" style={{ marginBottom: 13 }}>{label}</div> : null}
      <div className="seg-wrap inset tight" role="tablist" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="tab"
            aria-selected={o.value === value}
            className={`seg${o.value === value ? ' on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.blurb ? <small>{o.blurb}</small> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="slider-row">
      <div className="slider-top">
        <span className="label">{label}</span>
        <span className="val">{display}</span>
      </div>
      <div className="track inset">
        <i style={{ width: `${pct}%` }} />
        <span className="pin" style={{ left: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  )
}
