import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import logoUrl from '@/assets/logo.svg'
import { END_START } from './timeline'

/** Final brand card — fades up over the panel, prism logo + tagline. */
export function EndCard() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - END_START

  const opacity = interpolate(local, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const pop = spring({ frame: local, fps, config: { damping: 14, mass: 0.6 } })
  const logoScale = interpolate(pop, [0, 1], [0.8, 1])

  return (
    <div className="endcard" style={{ opacity }}>
      <img
        className="endcard-logo"
        src={logoUrl}
        alt=""
        style={{ transform: `scale(${logoScale})` }}
      />
      <div className="endcard-brand">Crystal</div>
      <div className="endcard-tag">Private, on-device AI — right in your browser</div>
    </div>
  )
}
