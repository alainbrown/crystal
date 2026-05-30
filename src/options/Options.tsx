import { useEffect, useState } from 'react'
import logoUrl from '@/assets/logo.svg'
import { MODELS, formatSize, getModel } from '@/lib/models'
import { useSettings } from '@/hooks/useSettings'
import { useApplyTheme } from '@/hooks/useApplyTheme'
import { clearConversations } from '@/lib/conversations'
import { Section, Segmented, Slider, Toggle } from './components/controls'

const NAV = [
  { id: 'model', icon: '🧠', label: 'Model' },
  { id: 'generation', icon: '✨', label: 'Generation' },
  { id: 'compute', icon: '⚡', label: 'Compute' },
  { id: 'privacy', icon: '🌿', label: 'Privacy & data' },
  { id: 'appearance', icon: '🎨', label: 'Appearance' },
  { id: 'about', icon: 'ℹ️', label: 'About' },
]

function useWebGPU(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    setOk(typeof navigator !== 'undefined' && 'gpu' in navigator)
  }, [])
  return ok
}

export function Options() {
  const { settings, loaded, update } = useSettings()
  const webgpu = useWebGPU()
  const [cleared, setCleared] = useState(false)

  useApplyTheme(settings.theme)

  async function clearHistory() {
    await clearConversations()
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  if (!loaded) return null

  return (
    <>
      <div className="topbar">
        <img className="logo" src={logoUrl} alt="" />
        <div className="ttl">
          <h1>Crystal Settings</h1>
          <p>tune your quiet on-device companion</p>
        </div>
        <div className="saved">
          <span className="tick">✓</span> changes saved automatically
        </div>
      </div>

      <div className="layout">
        <nav className="card">
          {NAV.map((n, i) => (
            <a key={n.id} href={`#${n.id}`} className={i === 0 ? 'on' : ''}>
              <span className="ic">{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>

        <div className="content">
          <Section id="model" icon="🧠" title="Model" subtitle="Choose which Qwen3.5 model answers you. Weights download on first use and are cached.">
            <div className="mlist" role="radiogroup" aria-label="Model">
              {MODELS.map((m) => {
                const active = m.id === settings.modelId
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`mfile${active ? ' active' : ''}`}
                    onClick={() => update({ modelId: m.id })}
                  >
                    <div className={`mdot ${active ? 'cached' : 'empty'}`}>{active ? '✓' : '↓'}</div>
                    <div className="minfo">
                      <div className="mname">
                        {m.family} {m.label}
                      </div>
                      <div className="msize">
                        {m.blurb} · ~{formatSize(m.approxDownloadMB)}
                        {active ? ` · ${settings.precision}` : ''}
                      </div>
                    </div>
                    <span className={`mtag${active ? ' on' : ''}`}>{active ? 'Active' : 'Use'}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section id="generation" icon="✨" title="Generation" subtitle="How adventurous and how long Crystal's replies are.">
            <Slider
              label="Temperature"
              value={settings.temperature}
              display={settings.temperature.toFixed(1)}
              min={0}
              max={2}
              step={0.1}
              onChange={(temperature) => update({ temperature })}
            />
            <Slider
              label="Max reply length"
              value={settings.maxTokens}
              display={`${settings.maxTokens} tok`}
              min={64}
              max={getModel(settings.modelId).contextTokens}
              step={64}
              onChange={(maxTokens) => update({ maxTokens })}
            />
            <Toggle
              label="Reasoning mode"
              desc="Let the model think step-by-step before replying. Slower, but better on tricky questions."
              checked={settings.reasoning}
              onChange={(reasoning) => update({ reasoning })}
            />
          </Section>

          <Section id="compute" icon="⚡" title="Compute" subtitle="Where and how the math runs on your hardware.">
            <div className="row">
              <div>
                <div className="label">Backend</div>
                <div className="desc">
                  {webgpu === null
                    ? 'Detecting…'
                    : webgpu
                      ? 'WebGPU available — inference runs fully on-device.'
                      : 'WebGPU not detected. Enable CPU fallback below to still run (much slower).'}
                </div>
              </div>
              <div className="badge-on" data-ok={webgpu ? 'yes' : 'no'}>
                {webgpu === false ? 'No WebGPU' : 'WebGPU'}
              </div>
            </div>
            <Segmented
              label="Precision"
              value={settings.precision}
              onChange={(precision) => update({ precision })}
              options={[
                { value: 'q4', label: 'q4', blurb: 'most compatible' },
                { value: 'q4f16', label: 'q4f16', blurb: 'recommended' },
                { value: 'q8', label: 'q8', blurb: 'balanced' },
                { value: 'fp16', label: 'fp16', blurb: 'sharpest' },
              ]}
            />
            <Toggle
              label="CPU fallback"
              desc="Use WebAssembly if WebGPU isn't available. Much slower — off by default."
              checked={settings.cpuFallback}
              onChange={(cpuFallback) => update({ cpuFallback })}
            />
          </Section>

          <Section id="privacy" icon="🌿" title="Privacy & data" subtitle="The whole point of Crystal.">
            <div className="note">
              <span className="ring" /> Everything runs on your device. No server, no API key —{' '}
              <b>0 bytes</b> have ever left this machine.
            </div>
            <Toggle
              label="Remember conversations"
              desc="Save chats locally in this browser so they're here next time. Stored only on this device."
              checked={settings.rememberConversations}
              onChange={(rememberConversations) => update({ rememberConversations })}
            />
            <button className="btn-soft warm" onClick={clearHistory}>
              {cleared ? 'Cleared ✓' : 'Clear conversation history'}
            </button>
          </Section>

          <Section id="appearance" icon="🎨" title="Appearance" subtitle="Make the panel feel like yours.">
            <Segmented
              label="Theme"
              desc="Defaults to System — Crystal follows your OS light/dark setting automatically."
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: 'system', label: 'System', icon: '🖥️' },
                { value: 'light', label: 'Light', icon: '☀️' },
                { value: 'dark', label: 'Dark', icon: '🌙' },
              ]}
            />
          </Section>

          <Section id="about" icon="ℹ️" title="About" subtitle="What's under the hood.">
            <div className="about">
              <div className="arow">
                Crystal <span>v{__APP_VERSION__}</span>
              </div>
              <div className="arow">
                Engine <span>transformers.js 4.2.0</span>
              </div>
              <div className="arow">
                Model family <span>Qwen3.5 · ONNX-OPT</span>
              </div>
              <div className="arow">
                Runtime <span>onnxruntime-web · WebGPU</span>
              </div>
            </div>
            <div className="links">
              <a href="https://huggingface.co/onnx-community" target="_blank" rel="noreferrer">
                Model card
              </a>
              <a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noreferrer">
                Engine
              </a>
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}
