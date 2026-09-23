import { ANALYSIS_ITEMS } from './analysisItems'

interface AnalysisRailProps {
  selected: string | null
  onSelect: (id: string) => void
  values?: Record<string, string>
}

/** Small abstract measurement glyph (two anchor points + a span) reused for every item. */
function MeasureIcon({ active }: { active: boolean }) {
  const stroke = active ? '#c9a55c' : '#8a8d94'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="3" r="1.6" stroke={stroke} strokeWidth="1.2" />
      <circle cx="13" cy="13" r="1.6" stroke={stroke} strokeWidth="1.2" />
      <line x1="4.3" y1="4.3" x2="11.7" y2="11.7" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 1.5" />
    </svg>
  )
}

export function AnalysisRail({ selected, onSelect, values }: AnalysisRailProps) {
  return (
    <nav className="flex w-52 flex-col gap-0.5 overflow-y-auto border-l border-workstation-border bg-workstation-panel py-3">
      <span className="px-4 pb-2 text-[11px] font-medium tracking-[0.2em] text-workstation-muted">
        ANALYSIS
      </span>
      {ANALYSIS_ITEMS.map((item) => {
        const active = item.id === selected
        const value = values?.[item.id]
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={
              'flex items-center justify-between gap-2 border-l-2 px-4 py-2.5 text-left text-xs transition-colors ' +
              (active
                ? 'border-workstation-accent text-workstation-accent'
                : 'border-transparent text-workstation-muted hover:text-workstation-text')
            }
          >
            <span className="flex items-center gap-3">
              <MeasureIcon active={active} />
              {item.label}
            </span>
            {value && value !== 'view' && (
              <span className="shrink-0 text-[10px] tabular-nums text-workstation-muted">{value}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
