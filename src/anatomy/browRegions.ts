import {
  LEFT_EYEBROW_LATERAL,
  LEFT_EYEBROW_MEDIAL,
  RIGHT_EYEBROW_LATERAL,
  RIGHT_EYEBROW_MEDIAL,
} from './landmarkGroups'
import type { FaceRegion } from './regions'

/**
 * Lateral (outer-third) and medial (inner-third) brow, per side — the real
 * clinical distinction: lateral brow/lid hooding is the far more common
 * complaint addressed by endoscopic brow lift, medial lift mainly softens
 * glabellar tension. Points are upper-row-only, verified non-zigzagging
 * (see landmarkGroups.ts) — Lateral and Medial's anchors are concatenated
 * into one ordered path per side in deformFace.ts's brow-lift zone push,
 * with each point's own magnitude interpolated along it, so the lift is
 * one continuous ridge instead of separate lateral/medial bump sources.
 */
export const BROW_LIFT_REGIONS: FaceRegion[] = [
  {
    id: 'brow-lateral-right',
    label: 'Lateral Brow',
    side: 'right',
    getAnchors: (landmarks) => RIGHT_EYEBROW_LATERAL.map((i) => landmarks[i]),
  },
  {
    id: 'brow-medial-right',
    label: 'Medial Brow',
    side: 'right',
    getAnchors: (landmarks) => RIGHT_EYEBROW_MEDIAL.map((i) => landmarks[i]),
  },
  {
    id: 'brow-lateral-left',
    label: 'Lateral Brow',
    side: 'left',
    getAnchors: (landmarks) => LEFT_EYEBROW_LATERAL.map((i) => landmarks[i]),
  },
  {
    id: 'brow-medial-left',
    label: 'Medial Brow',
    side: 'left',
    getAnchors: (landmarks) => LEFT_EYEBROW_MEDIAL.map((i) => landmarks[i]),
  },
]
