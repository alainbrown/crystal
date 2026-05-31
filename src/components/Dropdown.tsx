import { useEffect, useRef, useState } from 'react'

export interface DropdownOption {
  value: string
  icon?: string
  title: string
  sub?: string
  /** Compact single-line label shown on the trigger button (falls back to title/sub). */
  triggerLabel?: string
}

export function Dropdown({
  value,
  options,
  onChange,
  disabled = false,
  className,
  ariaLabel,
  open: controlledOpen,
}: {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
  /** When set, the menu's open state is driven externally (Remotion demo). */
  open?: boolean
}) {
  const [localOpen, setOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(next: string) {
    setOpen(false)
    if (next !== value) onChange(next)
  }

  return (
    <div className={`dropdown${open ? ' open' : ''}${className ? ` ${className}` : ''}`} ref={ref}>
      <button
        type="button"
        className="dd-btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {current?.icon ? <span className="mi">{current.icon}</span> : null}
        <span className="lbl">
          {current?.triggerLabel ? (
            <b>{current.triggerLabel}</b>
          ) : (
            <>
              <b>{current?.title}</b>
              {current?.sub ? <small>{current.sub}</small> : null}
            </>
          )}
        </span>
        <span className="chev" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="dd-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`opt${o.value === value ? ' on' : ''}`}
              onClick={() => pick(o.value)}
            >
              {o.icon ? <span className="mi">{o.icon}</span> : null}
              <span className="lbl">
                <b>{o.title}</b>
                {o.sub ? <small>{o.sub}</small> : null}
              </span>
              <span className="tick" aria-hidden="true">
                ✓
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
