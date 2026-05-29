import '@/styles/tokens.css'
import '@/sidepanel/sidepanel.css'
import './demo.css'

import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Nunito'
import { BrowserFrame } from './BrowserFrame'
import { Panel } from './Panel'
import { Caption } from './Caption'
import { EndCard } from './EndCard'
import { DURATION, END_START, FPS } from './timeline'

const { fontFamily } = loadFont()

function Scene() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill className="stage" style={{ fontFamily }}>
      <BrowserFrame panel={<Panel />} />
      <Caption />
      {frame >= END_START ? <EndCard /> : null}
    </AbsoluteFill>
  )
}

// Panel-only composition (transparent bg) used to render crisp marketing
// screenshots of the real UI at chosen beats. 400×580 native, scaled 2×.
function ShotScene() {
  return (
    <AbsoluteFill style={{ fontFamily, background: 'transparent' }}>
      <div className="shot">
        <Panel />
      </div>
    </AbsoluteFill>
  )
}

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Demo"
        component={Scene}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Shot"
        component={ShotScene}
        durationInFrames={DURATION}
        fps={FPS}
        width={800}
        height={1160}
      />
    </>
  )
}
