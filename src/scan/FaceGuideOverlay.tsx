export type GuideState = 'none' | 'adjust' | 'good'

const STROKE: Record<GuideState, string> = {
  none: '#4b4e57',
  adjust: '#d98c3a',
  good: '#c9a55c',
}

interface FaceGuideOverlayProps {
  state: GuideState
}

/** An oval framing guide overlaid on the scan video, color-coded by framing quality. */
export function FaceGuideOverlay({ state }: FaceGuideOverlayProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <ellipse
        cx="200"
        cy="150"
        rx="95"
        ry="125"
        fill="none"
        stroke={STROKE[state]}
        strokeWidth="2"
        strokeDasharray={state === 'good' ? undefined : '6 6'}
        opacity="0.85"
      />
    </svg>
  )
}
