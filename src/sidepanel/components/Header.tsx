import { ModelSelector } from './ModelSelector'

function openSettings() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage()
  }
}

export function Header() {
  return (
    <header className="panel-header">
      <div className="logo">💎</div>
      <div className="brand">Crystal</div>
      <ModelSelector />
      <button className="gear" title="Settings" onClick={openSettings} aria-label="Open settings">
        ⚙
      </button>
    </header>
  )
}
