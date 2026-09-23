import { add, distance, scale, subtract } from '../math/vec3'
import type { Vec3 } from '../types/face'

/**
 * A user-placed point (dimpleplasty's click-to-place) is meaningless as a
 * fixed metric-space coordinate in Live AR: metric space is derived fresh
 * from the RAW live frame every frame (not corrected for head pose the way
 * the 3D Playground's canonical space is), so it's frame-relative, not
 * face-relative. A point stored as a bare Vec3 stays put on screen while
 * the actual cheek moves away from it the moment the head moves at all —
 * which reads as "the effect doesn't track my face."
 *
 * Fix: attach the point to whichever of the 468 tracked landmarks is
 * nearest at the moment it's placed, store the offset from that landmark
 * normalized by the face's scale at that moment, and re-derive the live
 * position each frame as landmark + offset*currentScale.
 *
 * The normalization matters on its own: a fixed-size offset wouldn't keep
 * pace as the user moves closer to or further from the camera after
 * placing the point — the whole face's metric-space scale changes with
 * camera distance, so an un-rescaled offset would make the point visibly
 * creep toward or away from its anchor as the user's distance from the
 * camera changes, even though their head hasn't moved relative to itself.
 */
export interface FaceAnchoredPoint {
  landmarkIndex: number
  offsetRatio: Vec3
}

/** `referenceScale` should be a stable facial measurement (e.g. interocular
 * distance) taken from the same `landmarks` the point was placed against. */
export function anchorPointToNearestLandmark(
  point: Vec3,
  landmarks: Vec3[],
  referenceScale: number,
): FaceAnchoredPoint {
  let nearestIndex = 0
  let nearestDist = Infinity
  for (let i = 0; i < landmarks.length; i++) {
    const d = distance(point, landmarks[i])
    if (d < nearestDist) {
      nearestDist = d
      nearestIndex = i
    }
  }
  const offset = subtract(point, landmarks[nearestIndex])
  return { landmarkIndex: nearestIndex, offsetRatio: scale(offset, 1 / (referenceScale || 1)) }
}

/** `liveScale` must be the same kind of measurement as `referenceScale` was,
 * taken fresh from this frame's `landmarks`. */
export function resolveAnchoredPoint(anchor: FaceAnchoredPoint, landmarks: Vec3[], liveScale: number): Vec3 {
  return add(landmarks[anchor.landmarkIndex], scale(anchor.offsetRatio, liveScale))
}
