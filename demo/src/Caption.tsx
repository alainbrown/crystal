import { interpolate, useCurrentFrame } from 'remotion'
import { CAPTIONS, type CaptionId } from './timeline'

const TEXT: Record<Exclude<CaptionId, null>, string> = {
  sidebar: 'Private AI, right in your sidebar',
  type: 'Just type — nothing leaves your device',
  think: 'Watch it reason, then answer — 100% on-device',
  models: 'Swap models in a single click',
}

const RAMP = 12 // frames to fade in / out

/** Lower-third caption card; opacity is interpolated from the frame. */
export function Caption() {
  const frame = useCurrentFrame()
  const seg = CAPTIONS.find((c) => frame >= c.start - RAMP && frame <= c.end + RAMP)
  if (!seg) return null

  const opacity = interpolate(
    frame,
    [seg.start - RAMP, seg.start, seg.end, seg.end + RAMP],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const lift = interpolate(opacity, [0, 1], [12, 0])

  return (
    <div className="caption" style={{ opacity, transform: `translate(-50%, ${lift}px)` }}>
      {TEXT[seg.id]}
    </div>
  )
}
