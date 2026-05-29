import logoUrl from '@/assets/logo.svg'
import { ModelSelector } from './ModelSelector'

function openSettings() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage()
  }
}

export function Header() {
  return (
    <header className="panel-header">
      <img className="logo" src={logoUrl} alt="" />
      <div className="brand">Crystal</div>
      <ModelSelector />
      <button className="gear" title="Settings" onClick={openSettings} aria-label="Open settings">
        ⚙
      </button>
    </header>
  )
}
