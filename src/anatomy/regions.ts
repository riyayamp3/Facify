import {
  CHEEK_OVAL_LEFT,
  CHEEK_OVAL_RIGHT,
  EYE_OUTER_CORNER_LEFT,
  EYE_OUTER_CORNER_RIGHT,
  MOUTH_CORNER_LEFT,
  MOUTH_CORNER_RIGHT,
  POSTERIOR_CHEEK_LEFT,
  POSTERIOR_CHEEK_RIGHT,
} from './landmarkGroups'
import type { Vec3 } from '../types/face'

export type RegionSide = 'left' | 'right'

export interface FaceRegion {
  id: string
  label: string
  side?: RegionSide
  /** One or more anchor points in canonical space (e.g. corner lift = both mouth corners, one slider). */
  getAnchors: (landmarks: Vec3[]) => Vec3[]
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
}

function mainBodyAnchor(mouthCorner: number, cheekOval: number) {
  return (landmarks: Vec3[]) => midpoint(landmarks[mouthCorner], landmarks[cheekOval])
}

/**
 * Buccal fat pad sits below the cheekbone, lateral to the nasolabial
 * fold — the "Main Body" anchor is the midpoint between the mouth corner
 * and the face-oval point at nose height on the same side. The "Buccal
 * Extension" reaches further back toward the masseter — modeled as a
 * point 40% of the way from the main body anchor toward the ear-adjacent
 * face-oval point. Both were verified by measuring distance to the
 * eye/cheekbone, nose and jaw/chin landmarks in canonical space: they
 * stay clear of all of them at the simulation's max radius (0.16), so
 * the "upper cheeks preserved, jowls untouched" exclusion zones hold.
 */
export const BUCCAL_REGIONS: FaceRegion[] = [
  {
    id: 'buccal-main-right',
    label: 'Main Body',
    side: 'right',
    getAnchors: (landmarks) => [mainBodyAnchor(MOUTH_CORNER_RIGHT, CHEEK_OVAL_RIGHT)(landmarks)],
  },
  {
    id: 'buccal-extension-right',
    label: 'Buccal Extension',
    side: 'right',
    getAnchors: (landmarks) => [
      lerp(mainBodyAnchor(MOUTH_CORNER_RIGHT, CHEEK_OVAL_RIGHT)(landmarks), landmarks[POSTERIOR_CHEEK_RIGHT], 0.4),
    ],
  },
  {
    id: 'buccal-main-left',
    label: 'Main Body',
    side: 'left',
    getAnchors: (landmarks) => [mainBodyAnchor(MOUTH_CORNER_LEFT, CHEEK_OVAL_LEFT)(landmarks)],
  },
  {
    id: 'buccal-extension-left',
    label: 'Buccal Extension',
    side: 'left',
    getAnchors: (landmarks) => [
      lerp(mainBodyAnchor(MOUTH_CORNER_LEFT, CHEEK_OVAL_LEFT)(landmarks), landmarks[POSTERIOR_CHEEK_LEFT], 0.4),
    ],
  },
]

export { midpoint, lerp }

/**
 * Khoo Boo-Chai point — the traditional dimple placement reference:
 * intersection of a vertical line down from the outer eye corner and a
 * horizontal line across from the mouth corner. Real practice adjusts
 * from here per face shape/patient preference (that's what click-to-place
 * is for) — this is just the cited starting point, not a fixed rule.
 * Verified clear of the mouth (0.064), eye (0.22), nose (0.22) and the
 * buccal fat zone (0.21+) in canonical space.
 */
export function getKbcPoint(landmarks: Vec3[], side: RegionSide): Vec3 {
  const eyeOuter = landmarks[side === 'right' ? EYE_OUTER_CORNER_RIGHT : EYE_OUTER_CORNER_LEFT]
  const mouthCorner = landmarks[side === 'right' ? MOUTH_CORNER_RIGHT : MOUTH_CORNER_LEFT]
  return { x: eyeOuter.x, y: mouthCorner.y, z: (eyeOuter.z + mouthCorner.z) / 2 }
}
