function openSettings() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage()
  }
}

export function Header() {
  return (
    <header className="panel-header">
      <div className="toprow">
        <div className="logo">
          <span className="gem">💎</span>
        </div>
        <div className="brand">
          <h1>Crystal</h1>
          <p>your quiet on-device companion</p>
        </div>
        <button className="gear" title="Settings" onClick={openSettings} aria-label="Open settings">
          ⚙
        </button>
      </div>
      <div className="privacy soft">
        <span className="ring" /> running locally · WebGPU · stays with you
      </div>
    </header>
  )
}
