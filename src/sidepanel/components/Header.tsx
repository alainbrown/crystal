import logoUrl from '@/assets/logo.svg'
import { useChatStore } from '@/store/chat-store'
import { ModelSelector } from './ModelSelector'
import { History } from './History'

function openSettings() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage()
  }
}

export function Header() {
  const newConversation = useChatStore((s) => s.newConversation)
  return (
    <header className="panel-header">
      <img className="logo" src={logoUrl} alt="Crystal" />
      <button className="newchat" onClick={newConversation} title="New chat" aria-label="New chat">
        <span className="newchat-plus" aria-hidden="true">＋</span>
        New
      </button>
      <ModelSelector />
      <History />
      <button className="gear" title="Settings" onClick={openSettings} aria-label="Open settings">
        ⚙
      </button>
    </header>
  )
}
