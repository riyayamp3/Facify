import type { ViewAnglePreset } from '../types/face'

export const VIEW_ANGLE_YAW: Record<ViewAnglePreset, number> = {
  L90: -90,
  L45: -45,
  L23: -23,
  FRONT: 0,
  R23: 23,
  R45: 45,
  R90: 90,
}

const PRESETS: ViewAnglePreset[] = ['L90', 'L45', 'L23', 'FRONT', 'R23', 'R45', 'R90']

interface ViewAngleBarProps {
  value: ViewAnglePreset
  onChange: (preset: ViewAnglePreset) => void
}

export function ViewAngleBar({ value, onChange }: ViewAngleBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-workstation-border bg-workstation-panel px-2 py-1.5">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => onChange(preset)}
          className={
            'rounded-full px-3 py-1 text-xs font-medium tracking-wide transition-colors ' +
            (preset === value
              ? 'bg-workstation-accent text-black'
              : 'text-workstation-muted hover:text-workstation-text')
          }
        >
          {preset}
        </button>
      ))}
    </div>
  )
}
