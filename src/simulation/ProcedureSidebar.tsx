import { BUCCAL_FAT_PAD } from '../anatomy/buccalFatData'
import { BROW_LIFT_REGIONS } from '../anatomy/browRegions'
import { HAIRLINE_REGIONS } from '../anatomy/hairlineRegions'
import { LIP_LIFT_REGIONS } from '../anatomy/lipRegions'
import { BUCCAL_REGIONS } from '../anatomy/regions'
import {
  BROW_MAX_RADIUS,
  BROW_MIN_RADIUS,
  DIMPLE_MAX_RADIUS,
  DIMPLE_MIN_RADIUS,
  HAIRLINE_MAX_RADIUS,
  HAIRLINE_MIN_RADIUS,
  LIP_MAX_RADIUS,
  LIP_MIN_RADIUS,
  MAX_RADIUS,
  MIN_RADIUS,
  SIDES,
  UI_MAX_CC,
} from './deformFace'
import { PROCEDURES } from './procedures'
import type { ProcedureControls } from './useProcedureControls'

export type ViewMode = 'original' | 'simulated' | 'difference'

interface ProcedureSidebarProps {
  controls: ProcedureControls
  /** Omit the Original/Simulated/Difference toggle — Live AR has no static
   * base mesh to compare against, it's always showing the live effect. */
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  /** False in Live AR — there's no 3D scene to drag a marker on there. */
  showDragHints?: boolean
}

export function ProcedureSidebar({ controls, viewMode, onViewModeChange, showDragHints = true }: ProcedureSidebarProps) {
  const {
    selectedProcedure,
    setSelectedProcedure,
    extractedCc,
    radius,
    setRadius,
    liftPercent,
    lipRadius,
    setLipRadius,
    dimplePositions,
    setDimplePositions,
    dimpleDepth,
    setDimpleDepth,
    dimpleRadius,
    setDimpleRadius,
    browRadius,
    setBrowRadius,
    hairlineRadius,
    setHairlineRadius,
    isBuccal,
    isLipLift,
    isDimple,
    isBrow,
    isHairline,
    sideTotal,
    setRegionCc,
    setRegionLift,
  } = controls

  return (
    <aside className="flex w-64 flex-col gap-0.5 overflow-y-auto border-l border-workstation-border bg-workstation-panel py-3">
      <span className="px-4 pb-2 text-[11px] font-medium tracking-[0.2em] text-workstation-muted">
        PROCEDURES
      </span>
      {PROCEDURES.map((proc) => {
        const active = proc.id === selectedProcedure
        const disabled = proc.status === 'coming-soon'
        return (
          <button
            key={proc.id}
            disabled={disabled}
            onClick={() => setSelectedProcedure(proc.id)}
            className={
              'flex items-center justify-between border-l-2 px-4 py-2.5 text-left text-xs transition-colors ' +
              (disabled
                ? 'cursor-not-allowed border-transparent text-workstation-muted/40'
                : active
                  ? 'border-workstation-accent text-workstation-accent'
                  : 'border-transparent text-workstation-muted hover:text-workstation-text')
            }
          >
            {proc.label}
            {disabled && <span className="text-[9px] tracking-wide">SOON</span>}
          </button>
        )
      })}

      {isBuccal && (
        <div className="mt-4 flex flex-col gap-4 border-t border-workstation-border px-4 pt-4">
          <p className="text-[11px] leading-relaxed text-workstation-muted">
            Full pad ≈ {BUCCAL_FAT_PAD.averageTotalVolumeCc}cc per side. Conservative removal is{' '}
            {BUCCAL_FAT_PAD.typicalRemovedMinCc}–{BUCCAL_FAT_PAD.typicalRemovedMaxCc}cc — each side caps
            at {UI_MAX_CC.toFixed(1)}cc total ({BUCCAL_FAT_PAD.conservativeMaxFraction * 100}% of the pad)
            across both controls combined, to avoid a hollowed look.
          </p>

          {SIDES.map((side) => {
            const total = sideTotal(side, extractedCc)
            return (
              <div key={side} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between border-b border-workstation-border/60 pb-1">
                  <span className="text-[11px] font-medium tracking-[0.15em] text-workstation-text">
                    {side.toUpperCase()} CHEEK
                  </span>
                  <span className="text-[11px] text-workstation-muted">
                    {total.toFixed(1)} / {UI_MAX_CC.toFixed(1)}cc
                  </span>
                </div>
                {BUCCAL_REGIONS.filter((r) => r.side === side).map((region) => (
                  <div key={region.id} className="flex flex-col gap-1.5 pl-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] tracking-widest text-workstation-muted">{region.label}</span>
                      <span className="text-xs text-workstation-accent">
                        {(extractedCc[region.id] ?? 0).toFixed(1)}cc
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={UI_MAX_CC}
                      step={0.1}
                      value={extractedCc[region.id] ?? 0}
                      onChange={(e) => setRegionCc(region.id, Number(e.target.value))}
                      className="accent-workstation-accent"
                    />
                  </div>
                ))}
              </div>
            )
          })}

          <p className="text-[11px] text-workstation-muted">
            Δ between sides:{' '}
            <span className="text-workstation-text">
              {Math.abs(sideTotal('right', extractedCc) - sideTotal('left', extractedCc)).toFixed(1)}cc
            </span>{' '}
            — surgeons balance contour between sides rather than target an exact volume.
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.15em] text-workstation-muted">AREA</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(((radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100)}
              onChange={(e) => setRadius(MIN_RADIUS + (Number(e.target.value) / 100) * (MAX_RADIUS - MIN_RADIUS))}
              className="accent-workstation-accent"
            />
            <span className="text-xs text-workstation-muted">
              Confined to the accessible pocket — upper cheeks, nose and jawline stay untouched even at
              max area.
            </span>
            {showDragHints && (
              <span className="text-xs text-workstation-muted">Drag a marker on the face, or use the sliders.</span>
            )}
          </div>
        </div>
      )}

      {isLipLift && (
        <div className="mt-4 flex flex-col gap-4 border-t border-workstation-border px-4 pt-4">
          <p className="text-[11px] leading-relaxed text-workstation-muted">
            Three independent techniques — pick a lift amount for each. No clinical mm reference was
            given, so this is a 0–100% preview, not a calibrated measurement.
          </p>

          {LIP_LIFT_REGIONS.map((region) => (
            <div key={region.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] tracking-widest text-workstation-muted">{region.label}</span>
                <span className="text-xs text-workstation-accent">{Math.round(liftPercent[region.id] ?? 0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={liftPercent[region.id] ?? 0}
                onChange={(e) => setRegionLift(region.id, Number(e.target.value))}
                className="accent-workstation-accent"
              />
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.15em] text-workstation-muted">AREA</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(((lipRadius - LIP_MIN_RADIUS) / (LIP_MAX_RADIUS - LIP_MIN_RADIUS)) * 100)}
              onChange={(e) =>
                setLipRadius(LIP_MIN_RADIUS + (Number(e.target.value) / 100) * (LIP_MAX_RADIUS - LIP_MIN_RADIUS))
              }
              className="accent-workstation-accent"
            />
            {showDragHints && (
              <span className="text-xs text-workstation-muted">Drag a marker on the lip, or use the sliders.</span>
            )}
          </div>
        </div>
      )}

      {isDimple && (
        <div className="mt-4 flex flex-col gap-4 border-t border-workstation-border px-4 pt-4">
          <p className="text-[11px] leading-relaxed text-workstation-muted">
            Starts at the Khoo Boo-Chai point (the traditional reference: outer eye corner ∩ mouth
            corner) — click anywhere on a cheek to move it for your face shape. Real dimples only show
            when the buccinator contracts during a smile — surgeons verify the result both at rest and
            smiling for exactly that reason, so the depth below is the target at a full smile
            {!showDragHints ? ' — the live effect scales down at rest and back up as you smile' : ''}.
            No clinical depth reference was given, so this is a 0–100% preview, not a calibrated
            measurement.
          </p>

          {SIDES.map((side) => {
            const placed = dimplePositions[side]
            return (
              <div key={side} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] tracking-widest text-workstation-muted">
                    {side.toUpperCase()} CHEEK
                  </span>
                  {placed ? (
                    <button
                      onClick={() =>
                        setDimplePositions((prev) => {
                          const next = { ...prev }
                          delete next[side]
                          return next
                        })
                      }
                      className="text-[10px] text-workstation-muted hover:text-workstation-text"
                    >
                      Clear
                    </button>
                  ) : (
                    <span className="text-[10px] text-workstation-muted/60">Not placed</span>
                  )}
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  disabled={!placed}
                  value={dimpleDepth[side] ?? 0}
                  onChange={(e) => setDimpleDepth((prev) => ({ ...prev, [side]: Number(e.target.value) }))}
                  className="accent-workstation-accent disabled:opacity-30"
                />
              </div>
            )
          })}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.15em] text-workstation-muted">AREA</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(((dimpleRadius - DIMPLE_MIN_RADIUS) / (DIMPLE_MAX_RADIUS - DIMPLE_MIN_RADIUS)) * 100)}
              onChange={(e) =>
                setDimpleRadius(
                  DIMPLE_MIN_RADIUS + (Number(e.target.value) / 100) * (DIMPLE_MAX_RADIUS - DIMPLE_MIN_RADIUS),
                )
              }
              className="accent-workstation-accent"
            />
          </div>
        </div>
      )}

      {isBrow && (
        <div className="mt-4 flex flex-col gap-4 border-t border-workstation-border px-4 pt-4">
          <p className="text-[11px] leading-relaxed text-workstation-muted">
            Two zones per side — Lateral addresses brow/lid hooding (the far more common concern),
            Medial raises the inner brow and softens glabellar tension. No clinical mm reference was
            given, so this is a 0–100% preview, not a calibrated measurement.
          </p>

          {SIDES.map((side) => (
            <div key={side} className="flex flex-col gap-3">
              <span className="border-b border-workstation-border/60 pb-1 text-[11px] font-medium tracking-[0.15em] text-workstation-text">
                {side.toUpperCase()} BROW
              </span>
              {BROW_LIFT_REGIONS.filter((r) => r.side === side).map((region) => (
                <div key={region.id} className="flex flex-col gap-1.5 pl-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] tracking-widest text-workstation-muted">{region.label}</span>
                    <span className="text-xs text-workstation-accent">
                      {Math.round(liftPercent[region.id] ?? 0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={liftPercent[region.id] ?? 0}
                    onChange={(e) => setRegionLift(region.id, Number(e.target.value))}
                    className="accent-workstation-accent"
                  />
                </div>
              ))}
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.15em] text-workstation-muted">AREA</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(((browRadius - BROW_MIN_RADIUS) / (BROW_MAX_RADIUS - BROW_MIN_RADIUS)) * 100)}
              onChange={(e) =>
                setBrowRadius(BROW_MIN_RADIUS + (Number(e.target.value) / 100) * (BROW_MAX_RADIUS - BROW_MIN_RADIUS))
              }
              className="accent-workstation-accent"
            />
            <span className="text-xs text-workstation-muted">Confined well clear of the eyelid even at max area.</span>
            {showDragHints && (
              <span className="text-xs text-workstation-muted">Drag a marker on the brow, or use the sliders.</span>
            )}
          </div>
        </div>
      )}

      {isHairline && (
        <div className="mt-4 flex flex-col gap-4 border-t border-workstation-border px-4 pt-4">
          <p className="text-[11px] leading-relaxed text-workstation-muted">
            MediaPipe doesn't track hair — this approximates the surgical effect (advancing the
            forehead-skin boundary) rather than rendering hair itself. Central lowers mid-forehead
            height; Temporal fills in a receded corner per side. No clinical cm reference was given, so
            this is a 0–100% preview, not a calibrated measurement.
          </p>

          {HAIRLINE_REGIONS.map((region) => (
            <div key={region.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] tracking-widest text-workstation-muted">
                  {region.side ? `${region.side.toUpperCase()} ` : ''}
                  {region.label}
                </span>
                <span className="text-xs text-workstation-accent">{Math.round(liftPercent[region.id] ?? 0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={liftPercent[region.id] ?? 0}
                onChange={(e) => setRegionLift(region.id, Number(e.target.value))}
                className="accent-workstation-accent"
              />
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.15em] text-workstation-muted">AREA</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(
                ((hairlineRadius - HAIRLINE_MIN_RADIUS) / (HAIRLINE_MAX_RADIUS - HAIRLINE_MIN_RADIUS)) * 100,
              )}
              onChange={(e) =>
                setHairlineRadius(
                  HAIRLINE_MIN_RADIUS + (Number(e.target.value) / 100) * (HAIRLINE_MAX_RADIUS - HAIRLINE_MIN_RADIUS),
                )
              }
              className="accent-workstation-accent"
            />
            {showDragHints && (
              <span className="text-xs text-workstation-muted">Drag a marker on the forehead, or use the sliders.</span>
            )}
          </div>
        </div>
      )}

      {viewMode && onViewModeChange && (
        <div className="flex flex-col gap-4 px-4 pt-2">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.15em] text-workstation-muted">VIEW</span>
            <div className="flex gap-1">
              {(['original', 'simulated', 'difference'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onViewModeChange(mode)}
                  className={
                    'flex-1 rounded-sm border px-2 py-1.5 text-[11px] capitalize transition-colors ' +
                    (viewMode === mode
                      ? 'border-workstation-accent text-workstation-accent'
                      : 'border-workstation-border text-workstation-muted hover:text-workstation-text')
                  }
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-workstation-muted">
            Visualization only — not a prediction of surgical outcome.
          </p>
        </div>
      )}
    </aside>
  )
}
