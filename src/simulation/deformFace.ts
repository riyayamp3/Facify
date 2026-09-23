import { BROW_LIFT_REGIONS } from '../anatomy/browRegions'
import { HAIRLINE_REGIONS } from '../anatomy/hairlineRegions'
import { LIP_LIFT_REGIONS } from '../anatomy/lipRegions'
import { BUCCAL_REGIONS, type FaceRegion, type RegionSide } from '../anatomy/regions'
import { MAX_EXTRACTABLE_CC } from '../anatomy/buccalFatData'
import {
  applyRadialDeformation,
  applyRadialDeformationMulti,
  applyRadialDeformationPath,
  applyRadialDeformationPathWeighted,
  inwardDirection,
} from '../deformation/radialField'
import type { Vec3 } from '../types/face'

// --- Buccal fat removal: cc-based, calibrated to real pad volume data. ---
// Mesh-space displacement at the clinical ceiling (MAX_EXTRACTABLE_CC).
export const MAX_MESH_MAGNITUDE = 0.15
// Calibrated against verified landmark distances from the region anchors
// (see anatomy/regions.ts): must stay clear of the eye/cheekbone
// (~0.186-0.207), nose tip (~0.273) and chin/jowl (~0.23-0.26) so the
// "upper cheeks preserved, jowls/jawline untouched" exclusion zones hold
// even at the slider's max, while still reaching the mouth-corner
// vicinity (~0.128) that defines the actual target zone.
export const MIN_RADIUS = 0.08
export const MAX_RADIUS = 0.16
export const DEFAULT_RADIUS = 0.13
// A broad, gentle hollow rather than a crisp pit — subtler shadow than
// dimpleplasty's (see DeformationZone.shadowStrength).
export const BUCCAL_SHADOW_STRENGTH = 0.12
export const DRAG_SENSITIVITY_CC = 0.03 // cc per pixel of vertical drag
export const SIDES: RegionSide[] = ['right', 'left']
// Step-aligned (0.1cc) version of the clinical ceiling, rounded DOWN so
// the UI never lets the cap drift slightly over the true 50% rule due to
// range-input step-snapping (e.g. 4.65 isn't reachable at step=0.1).
export const UI_MAX_CC = Math.floor(MAX_EXTRACTABLE_CC * 10) / 10

// --- Lip lift: no clinical mm figures were given, so this is a simple
// 0-100% control (not fabricated units) confined to the tight lip/philtrum
// area (verified landmark span ~0.04-0.15 units) — smaller radius bounds
// than buccal fat's much larger cheek area. Direction pulls up and
// slightly forward, matching "pulls the lip up and rolls it outward". ---
// Verified nose-base-to-lip-top gap is ~0.041 canonical units — pushing
// further than that folds the lip geometry past the nose base and
// self-intersects (looks jagged/broken regardless of falloff shape).
// Keep well under it.
export const LIP_MAX_MAGNITUDE = 0.02
export const LIP_MIN_RADIUS = 0.02
export const LIP_MAX_RADIUS = 0.055
export const LIP_DEFAULT_RADIUS = 0.035
export const LIP_DRAG_SENSITIVITY = 0.5 // percent per pixel of vertical drag
export const LIP_DIRECTION = { x: 0, y: 1, z: 0.25 }

// --- Dimpleplasty: position is user-clicked (the surgeon marks the spot
// on the cheek), not a fixed landmark — the one procedure that isn't a
// FaceRegion. No clinical depth figures given, so 0-100% like lip lift.
// Cheek surface has room around it (unlike the tight lip/nose gap), so a
// moderate magnitude doesn't self-intersect. ---
export const DIMPLE_MAX_MAGNITUDE = 0.06
export const DIMPLE_MIN_RADIUS = 0.02
export const DIMPLE_MAX_RADIUS = 0.05
export const DIMPLE_DEFAULT_RADIUS = 0.03
// A real dimple reads almost entirely from the shadow its concave pit
// casts, not the displacement alone — a plain pixel-resample warp with no
// shadow looks like a soft pucker rather than a crisp dimple. Stronger
// than buccal fat's (see DeformationZone.shadowStrength) since a dimple
// is meant to read as a distinct, defined feature, not a broad hollow.
export const DIMPLE_SHADOW_STRENGTH = 0.35

// --- Endoscopic brow lift: no clinical mm figure given, so 0-100% like lip
// lift. Radius verified against real distances: brow-to-upper-eyelid is
// ~0.08-0.095 canonical units, so the max radius stays well under that —
// lifting the brow shouldn't visibly tug the eyelid itself. Direction is
// mostly up with a slight forward tilt (same reasoning as lip lift) so the
// lifted skin doesn't sink behind the forehead's natural curve. ---
export const BROW_MAX_MAGNITUDE = 0.025
export const BROW_MIN_RADIUS = 0.02
export const BROW_MAX_RADIUS = 0.05
export const BROW_DEFAULT_RADIUS = 0.035
export const BROW_DIRECTION = { x: 0, y: 1, z: 0.15 }

// --- Hairline lowering: MediaPipe has no hair/scalp geometry, so this
// advances the visible forehead-skin boundary instead (see
// anatomy/hairlineRegions.ts). 0-100%, no clinical cm figure given.
// Direction is down and slightly forward (advancing skin over the
// forehead's curve, the mirror of the brow lift's upward tilt). Radius
// kept at its original, verified-clear-of-the-eyebrows value (~0.09-0.22
// away at its max) — magnitude is the one that actually controls how far
// UP the effect reaches for source pixels (a backward-mapped warp samples
// from `anchor + magnitude`, not `anchor + radius`; radius only controls
// how WIDE the effect spreads, not how far it reaches). The original
// 0.025 (~9% of interocular distance) never reached far enough above the
// forehead to pull real hair into frame — real hairline advancement moves
// hair 1-3cm on a face with ~6cm interocular spacing, i.e. 15-45%, so
// 0.025 was roughly 2-4x too weak to read as anything happening at all. ---
export const HAIRLINE_MAX_MAGNITUDE = 0.06
export const HAIRLINE_MIN_RADIUS = 0.03
export const HAIRLINE_MAX_RADIUS = 0.08
export const HAIRLINE_DEFAULT_RADIUS = 0.055
export const HAIRLINE_DIRECTION = { x: 0, y: -1, z: 0.15 }

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/**
 * Interocular distance (outer-corner to outer-corner) in the mock scan
 * data every radius/magnitude constant above was verified against — the
 * implicit "reference face scale" those numbers assume. Live tracking has
 * no fixed scan distance (the user can lean toward or away from the
 * camera at any point), so Live AR scales radius/magnitude by
 * liveInterocular/this each frame to keep the effect anatomically
 * proportional regardless of how close the face is to the camera —
 * without it, leaning in would make every procedure look proportionally
 * weaker (bigger face, same fixed-size radius) and leaning back stronger.
 */
export const REFERENCE_INTEROCULAR = 0.277

export function ccToMeshMagnitude(cc: number): number {
  return (cc / MAX_EXTRACTABLE_CC) * MAX_MESH_MAGNITUDE
}

export function getActiveRegions(selectedProcedure: string): FaceRegion[] {
  switch (selectedProcedure) {
    case 'buccal-fat-removal':
      return BUCCAL_REGIONS
    case 'lip-lift':
      return LIP_LIFT_REGIONS
    case 'brow-lift':
      return BROW_LIFT_REGIONS
    case 'hairline-lowering':
      return HAIRLINE_REGIONS
    default:
      return []
  }
}

export interface ProcedureParams {
  selectedProcedure: string
  extractedCc: Record<string, number>
  radius: number
  liftPercent: Record<string, number>
  lipRadius: number
  dimplePositions: Partial<Record<RegionSide, Vec3>>
  dimpleDepth: Record<string, number>
  dimpleRadius: number
  browRadius: number
  hairlineRadius: number
}

/**
 * One active deformation's full parameters, before any specific rendering
 * technique (CPU vertex displacement, GPU per-pixel field) is applied to
 * it — the shared intermediate both `deformFace` (3D Playground, a static
 * mesh) and Live AR's shader (a live dense per-pixel warp) build from, so
 * neither can drift from what a slider is actually supposed to do.
 */
export interface DeformationZone {
  points: Vec3[]
  magnitude: number
  radius: number
  direction: Vec3
  /** Distance-to-nearest-segment across the whole polyline (lip-direct,
   * brow arcs) vs. distance-to-nearest-point (everything else, including
   * corner lift's two genuinely separate points — a path would wrongly
   * add influence in the gap between them). */
  isPath: boolean
  /**
   * Per-point override for `magnitude` (same length as `points`), used
   * when a path's points don't all move by the same amount — currently
   * only brow lift, whose Lateral and Medial arcs are independently
   * sliderd but concatenated into one continuous path per side (see
   * browRegions.ts). applyRadialDeformationPathWeighted interpolates
   * between a segment's two endpoint magnitudes along the same `t` the
   * falloff distance is measured at, so magnitude and position vary
   * together, smoothly, instead of jumping at a boundary. (Two earlier,
   * non-path approaches to this each fixed one defect and left another —
   * see that function's doc comment for the full history.) Undefined for
   * every other zone (they all move uniformly), and meaningless for a
   * non-path zone — nothing currently sets it on one.
   */
  pointMagnitudes?: number[]
  /**
   * How much Live AR's per-pixel warp darkens the sampled color at this
   * zone's deepest point (0 = untouched). A pure pixel-resample warp has
   * no lighting model, so a "pit" (dimple, buccal hollow) reads as a
   * gentle pucker rather than a real dimple's crisp, shadowed concavity —
   * real dimples get their read almost entirely from the shadow a
   * concave surface casts under normal lighting, not just displacement.
   * Only zones that actually recede (dimpleplasty, buccal fat) set this;
   * elevation-type effects (lip/brow lift, hairline) don't get an added
   * highlight yet — a real asymmetric shadow-and-highlight would need a
   * lighting direction we don't have, so this is deliberately a simple,
   * symmetric darken, not a claim of physically correct shading.
   */
  shadowStrength: number
}

/**
 * Builds the list of currently-active deformation zones for the selected
 * procedure (skipping any region whose slider is at 0) — the anatomical
 * "what and how much", independent of how it gets rendered.
 */
export function getDeformationZones(
  vertices: Vec3[],
  params: ProcedureParams,
  faceCenter: Vec3,
  scaleFactor = 1,
): DeformationZone[] {
  if (vertices.length === 0) return []

  const {
    selectedProcedure,
    extractedCc,
    radius,
    liftPercent,
    lipRadius,
    dimplePositions,
    dimpleDepth,
    dimpleRadius,
    browRadius,
    hairlineRadius,
  } = params
  const activeRegions = getActiveRegions(selectedProcedure)
  const regionAnchorGroups = activeRegions.map((region) => ({ region, anchors: region.getAnchors(vertices) }))

  const zones: DeformationZone[] = []
  if (selectedProcedure === 'buccal-fat-removal') {
    for (const { region, anchors } of regionAnchorGroups) {
      const cc = extractedCc[region.id] ?? 0
      if (cc === 0) continue
      zones.push({
        points: anchors,
        magnitude: ccToMeshMagnitude(cc) * scaleFactor,
        radius: radius * scaleFactor,
        direction: inwardDirection(anchors[0], faceCenter),
        isPath: false,
        // Scaled by the same cc ratio as magnitude — a shadow at full
        // strength regardless of how much fat is actually removed would
        // show a dark patch even at cc=0 (caught on a real camera: a dot
        // appeared on an unmodified cheek because this was a flat constant).
        shadowStrength: BUCCAL_SHADOW_STRENGTH * (cc / MAX_EXTRACTABLE_CC),
      })
    }
  } else if (selectedProcedure === 'lip-lift') {
    for (const { region, anchors } of regionAnchorGroups) {
      const pct = liftPercent[region.id] ?? 0
      if (pct === 0) continue
      zones.push({
        points: anchors,
        magnitude: (pct / 100) * LIP_MAX_MAGNITUDE * scaleFactor,
        radius: lipRadius * scaleFactor,
        direction: LIP_DIRECTION,
        isPath: region.id === 'lip-direct',
        shadowStrength: 0,
      })
    }
  } else if (selectedProcedure === 'dimpleplasty') {
    for (const side of SIDES) {
      const pos = dimplePositions[side]
      const depth = dimpleDepth[side] ?? 0
      if (!pos || depth === 0) continue
      zones.push({
        points: [pos],
        magnitude: (depth / 100) * DIMPLE_MAX_MAGNITUDE * scaleFactor,
        radius: dimpleRadius * scaleFactor,
        direction: inwardDirection(pos, faceCenter),
        isPath: false,
        // Same depth ratio as magnitude — in Live AR, depth is already
        // smile-scaled (0 at rest), so this is what makes the shadow fade
        // out at rest instead of showing a dark spot with no dimple.
        shadowStrength: (depth / 100) * DIMPLE_SHADOW_STRENGTH,
      })
    }
  } else if (selectedProcedure === 'brow-lift') {
    // Lateral and Medial, concatenated into one ordered path per side (see
    // browRegions.ts / landmarkGroups.ts for why this is a path over
    // upper-row-only points, not discrete per-point falloff over the full
    // ribbon) — each point keeps its own magnitude, interpolated along the
    // path by applyRadialDeformationPathWeighted, so the lift is one
    // continuous ridge instead of two separately-sourced bumps.
    for (const side of SIDES) {
      const lateral = regionAnchorGroups.find((g) => g.region.id === `brow-lateral-${side}`)
      const medial = regionAnchorGroups.find((g) => g.region.id === `brow-medial-${side}`)
      const lateralPct = liftPercent[`brow-lateral-${side}`] ?? 0
      const medialPct = liftPercent[`brow-medial-${side}`] ?? 0
      if (lateralPct === 0 && medialPct === 0) continue

      const lateralMagnitude = (lateralPct / 100) * BROW_MAX_MAGNITUDE * scaleFactor
      const medialMagnitude = (medialPct / 100) * BROW_MAX_MAGNITUDE * scaleFactor
      const points = [...(lateral?.anchors ?? []), ...(medial?.anchors ?? [])]
      const pointMagnitudes = [
        ...(lateral?.anchors.map(() => lateralMagnitude) ?? []),
        ...(medial?.anchors.map(() => medialMagnitude) ?? []),
      ]

      zones.push({
        points,
        pointMagnitudes,
        magnitude: Math.max(lateralMagnitude, medialMagnitude),
        radius: browRadius * scaleFactor,
        direction: BROW_DIRECTION,
        isPath: true,
        shadowStrength: 0,
      })
    }
  } else if (selectedProcedure === 'hairline-lowering') {
    for (const { region, anchors } of regionAnchorGroups) {
      const pct = liftPercent[region.id] ?? 0
      if (pct === 0) continue
      zones.push({
        points: anchors,
        magnitude: (pct / 100) * HAIRLINE_MAX_MAGNITUDE * scaleFactor,
        radius: hairlineRadius * scaleFactor,
        direction: HAIRLINE_DIRECTION,
        isPath: false,
        shadowStrength: 0,
      })
    }
  }
  return zones
}

/**
 * Applies the currently-selected procedure's deformation to a set of
 * vertices. Pure and procedure-state-driven so it works identically
 * whether `vertices` is a static scanned mesh (3D Playground, wrapped in
 * a useMemo) or a live per-frame landmark set (called fresh every frame)
 * — one source of truth for what each slider actually does.
 *
 * `faceCenter` is the reference point "inward" is measured toward (buccal
 * fat, dimpleplasty). Static canonical space is already centered on the
 * face's own centroid, so it defaults to the origin; live tracking space
 * is centered on the video frame, not the face, so callers must pass the
 * live centroid explicitly.
 */
export function deformFace(
  vertices: Vec3[],
  params: ProcedureParams,
  faceCenter: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3[] {
  // No real face data yet (e.g. Live AR before the first frame is
  // tracked) — region anchors would index past an empty array.
  if (vertices.length === 0) return vertices

  let verts = vertices
  for (const zone of getDeformationZones(vertices, params, faceCenter)) {
    verts = zone.isPath
      ? zone.pointMagnitudes
        ? applyRadialDeformationPathWeighted(verts, zone.points, zone.pointMagnitudes, zone.direction, zone.radius)
        : applyRadialDeformationPath(verts, zone.points, zone.direction, zone.magnitude, zone.radius)
      : zone.points.length > 1
        ? applyRadialDeformationMulti(verts, zone.points, zone.direction, zone.magnitude, zone.radius)
        : applyRadialDeformation(verts, zone.points[0], zone.direction, zone.magnitude, zone.radius)
  }
  return verts
}
