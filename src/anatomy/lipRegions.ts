import { MOUTH_CORNER_LEFT, MOUTH_CORNER_RIGHT, UPPER_LIP_BORDER, UPPER_LIP_TOP_CENTER } from './landmarkGroups'
import type { FaceRegion } from './regions'

/**
 * Verified midline column (canonical space, front frame): nose base (2)
 * y=-0.044, lip top-center (0) y=-0.085, mouth corners (61/291) at
 * y=-0.114, x=±0.077. Direct sits right at the vermilion border; Corner
 * uses both mouth corners under one slider (they lift together).
 *
 * Bullhorn's anchor sits AT the vermilion border (0) itself, not the
 * nose-base/lip-top midpoint used before: real bullhorn technique excises
 * skin between the nostril sill and vermilion border, then pulls the
 * (now-shortened) skin down to the border — the nose base itself doesn't
 * move. A midpoint anchor put nose base only ~0.02 units away (well
 * inside the falloff radius, ~0.035-0.055), so it got pushed up right
 * along with the lip — a visibly warped nose in the "wrong" result on
 * real camera footage. Anchored at the border, nose base is a full ~0.041
 * away — at or past the radius, so it stays essentially still — while the
 * push concentrates on the border itself, which is also what actually
 * creates "more lip shows": the mouth opening below stays fixed, so
 * lifting the border toward the nose increases the visible vermilion
 * height in between, instead of splitting the same push across two
 * boundaries and moving neither convincingly.
 */
export const LIP_LIFT_REGIONS: FaceRegion[] = [
  {
    id: 'lip-bullhorn',
    label: 'Bullhorn (Subnasal) Lift',
    getAnchors: (landmarks) => [landmarks[UPPER_LIP_TOP_CENTER]],
  },
  {
    id: 'lip-corner',
    label: 'Corner Lift',
    getAnchors: (landmarks) => [landmarks[MOUTH_CORNER_RIGHT], landmarks[MOUTH_CORNER_LEFT]],
  },
  {
    id: 'lip-direct',
    label: 'Direct Lift',
    // Unlike Bullhorn (central only) and Corner (edges only), Direct
    // lift removes skin along the whole upper-lip vermilion border, so
    // it needs the full corner-to-corner point spread, not one anchor.
    getAnchors: (landmarks) => UPPER_LIP_BORDER.map((i) => landmarks[i]),
  },
]
