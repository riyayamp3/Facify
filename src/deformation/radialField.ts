import type { Vec3 } from '../types/face'

function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

function normalize(v: Vec3): Vec3 {
  const len = length(v) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

/**
 * Smooth 1 (at the anchor) -> 0 (at the radius edge) falloff, zero outside.
 * Quintic ("smootherstep", Perlin) rather than the classic cubic
 * smoothstep: both are zero-derivative at the edges, but cubic's SECOND
 * derivative still jumps at t=0/1, which on real skin/hair texture (unlike
 * a flat synthetic gradient) reads as a faint but visible ring right at
 * the falloff boundary. Quintic is zero in the first AND second
 * derivative at both ends, softening that edge everywhere this is used.
 */
function smoothFalloff(distance: number, radius: number): number {
  if (distance >= radius) return 0
  const t = 1 - distance / radius
  return t * t * t * (t * (t * 6 - 15) + 10) // smootherstep
}

/**
 * Displaces vertices within `radius` of `anchor` along `direction`,
 * scaled by `magnitude` and a smooth radial falloff. Procedure-agnostic —
 * reused by every simulation (buccal fat, dimpleplasty, lip lift, brow
 * lift, hairline) with different anchors/directions/params, not
 * reimplemented per procedure.
 */
export function applyRadialDeformation(
  vertices: Vec3[],
  anchor: Vec3,
  direction: Vec3,
  magnitude: number,
  radius: number,
): Vec3[] {
  const dir = normalize(direction)
  return vertices.map((v) => {
    const offset = subtract(v, anchor)
    const distance = length(offset)
    const weight = smoothFalloff(distance, radius)
    if (weight === 0) return v
    const scale = magnitude * weight
    return { x: v.x + dir.x * scale, y: v.y + dir.y * scale, z: v.z + dir.z * scale }
  })
}

/**
 * Same as applyRadialDeformation but for a region with several anchors
 * sharing one control (e.g. a lip border traced by 10 points). Uses the
 * MAX falloff weight across all anchors per vertex, not a sum — applying
 * each anchor as a separate sequential pass would compound in overlap
 * zones (a vertex near 3 anchors gets pushed 3x), producing a lumpy,
 * over-deformed result instead of one smooth lift along the curve.
 */
export function applyRadialDeformationMulti(
  vertices: Vec3[],
  anchors: Vec3[],
  direction: Vec3,
  magnitude: number,
  radius: number,
): Vec3[] {
  const dir = normalize(direction)
  return vertices.map((v) => {
    let maxWeight = 0
    for (const anchor of anchors) {
      const weight = smoothFalloff(length(subtract(v, anchor)), radius)
      if (weight > maxWeight) maxWeight = weight
    }
    if (maxWeight === 0) return v
    const scale = magnitude * maxWeight
    return { x: v.x + dir.x * scale, y: v.y + dir.y * scale, z: v.z + dir.z * scale }
  })
}

/** Closest point on segment a->b to p, as both its distance and its
 * position along the segment (t=0 at a, t=1 at b) — the latter is what
 * lets a caller interpolate a per-endpoint value (e.g. magnitude) at
 * whatever point the falloff is actually measuring distance to. */
function closestOnSegment(p: Vec3, a: Vec3, b: Vec3): { t: number; dist: number } {
  const ab = subtract(b, a)
  const abLenSq = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z
  if (abLenSq === 0) return { t: 0, dist: length(subtract(p, a)) }
  const ap = subtract(p, a)
  const t = Math.min(1, Math.max(0, (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / abLenSq))
  const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }
  return { t, dist: length(subtract(p, closest)) }
}

/**
 * For a region that's a continuous BORDER traced by several points (e.g.
 * the whole upper-lip vermilion line), not separate bumps: falloff is by
 * distance to the nearest point on the polyline connecting them, not to
 * the nearest anchor. Anchor-based falloff (applyRadialDeformationMulti)
 * still shows visible seams between anchors on a coarse mesh even after
 * fixing compounding, because each anchor's influence region has its own
 * boundary; a polyline has none. Don't use this for regions that are
 * genuinely separate points with a gap (e.g. corner lift's two mouth
 * corners) — connecting those with a line would wrongly add influence in
 * the gap between them.
 */
export function applyRadialDeformationPath(
  vertices: Vec3[],
  pathPoints: Vec3[],
  direction: Vec3,
  magnitude: number,
  radius: number,
): Vec3[] {
  const dir = normalize(direction)
  return vertices.map((v) => {
    let minDist = pathPoints.length === 1 ? length(subtract(v, pathPoints[0])) : Infinity
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const { dist } = closestOnSegment(v, pathPoints[i], pathPoints[i + 1])
      if (dist < minDist) minDist = dist
    }
    const weight = smoothFalloff(minDist, radius)
    if (weight === 0) return v
    const scale = magnitude * weight
    return { x: v.x + dir.x * scale, y: v.y + dir.y * scale, z: v.z + dir.z * scale }
  })
}

/**
 * Same as applyRadialDeformationPath, but for a path whose endpoints don't
 * all move by the same amount — brow lift's Lateral and Medial arcs,
 * independently sliderd, concatenated into one path per side (see
 * deformFace.ts's brow-lift zone push).
 *
 * Two earlier attempts at this (both using discrete per-point falloff, not
 * a path) each fixed one defect and left another: summing two zones
 * doubled the push where their bubbles overlapped; taking the max of
 * (weight * that point's own magnitude) fixed the doubling but left a
 * visible crease where the "winning" point switched between differently-
 * scaled groups; averaging magnitude by weight fixed the crease but not
 * the deeper issue underneath both — 5 independent point-bubbles read as
 * "beads on a string" (verified: 4 separate local maxima along a sweep of
 * real brow coordinates) unless the radius is generous enough to fully
 * merge them into one ridge, which it wasn't at typical settings. A path
 * has no such seams by construction (that's the whole reason
 * applyRadialDeformationPath exists for lip-direct) — so instead of
 * patching the multi-point approach a third time, this measures distance
 * to the nearest point on the nearest SEGMENT as usual, and interpolates
 * that segment's two endpoint magnitudes by the same `t` the distance
 * itself was measured at, so magnitude and position vary together, smoothly,
 * along one continuous line.
 */
export function applyRadialDeformationPathWeighted(
  vertices: Vec3[],
  pathPoints: Vec3[],
  magnitudes: number[],
  direction: Vec3,
  radius: number,
): Vec3[] {
  const dir = normalize(direction)
  return vertices.map((v) => {
    let minDist = pathPoints.length === 1 ? length(subtract(v, pathPoints[0])) : Infinity
    let segMagnitude = magnitudes[0] ?? 0
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const { t, dist } = closestOnSegment(v, pathPoints[i], pathPoints[i + 1])
      if (dist < minDist) {
        minDist = dist
        segMagnitude = magnitudes[i] + (magnitudes[i + 1] - magnitudes[i]) * t
      }
    }
    const weight = smoothFalloff(minDist, radius)
    if (weight === 0) return v
    const scale = segMagnitude * weight
    return { x: v.x + dir.x * scale, y: v.y + dir.y * scale, z: v.z + dir.z * scale }
  })
}

/** Inward-toward-center direction at a point — reduces local convexity (buccal fat removal). */
export function inwardDirection(anchor: Vec3, center: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  return normalize(subtract(center, anchor))
}

export function displacementMagnitudes(original: Vec3[], deformed: Vec3[]): number[] {
  return original.map((p, i) => length(subtract(deformed[i], p)))
}
