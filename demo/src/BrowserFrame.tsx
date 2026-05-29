import type { ReactNode } from 'react'
import logoUrl from '@/assets/logo.svg'

/** A faux Chrome window with the Crystal side panel docked on the right. */
export function BrowserFrame({ panel }: { panel: ReactNode }) {
  return (
    <div className="bw">
      <div className="bw-toolbar">
        <div className="bw-lights">
          <i style={{ background: '#ff5f57' }} />
          <i style={{ background: '#febc2e' }} />
          <i style={{ background: '#28c840' }} />
        </div>
        <div className="bw-omni">
          <span className="bw-lock">🔒</span>
          <span>app.crystal.local</span>
        </div>
        <div className="bw-ext">
          <img src={logoUrl} alt="" />
        </div>
      </div>
      <div className="bw-body">
        <div className="bw-page">
          {/* faint placeholder webpage */}
          <div className="ph ph-title" />
          <div className="ph ph-line" />
          <div className="ph ph-line short" />
          <div className="ph ph-block" />
          <div className="ph ph-line" />
          <div className="ph ph-line short" />
        </div>
        <div className="bw-dock">
          <div className="panel-scaler">{panel}</div>
        </div>
      </div>
    </div>
  )
}
