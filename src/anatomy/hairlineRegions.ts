import { EYE_OUTER_CORNER_LEFT, EYE_OUTER_CORNER_RIGHT, GLABELLA } from './landmarkGroups'
import type { FaceRegion } from './regions'
import { distance } from '../math/vec3'

// Verified (canonical space, mock scan data) as
// glabella-to-forehead-top-distance / interocular-distance ≈ 0.1344/0.2768.
// Deriving Central from this ratio — rather than the raw forehead-top
// landmark (index 10) directly — makes it self-scaling from whatever
// interocular distance the current `landmarks` array actually has, so it
// stays anatomically correct at both the 3D Playground's fixed scan scale
// and Live AR's constantly-changing one, with no separate scale-factor
// plumbing needed.
const CENTRAL_OFFSET_RATIO = 0.4856
// Central used to be a single point, which a radial falloff necessarily
// pulls into a circular "cone" — invisible on a flat synthetic test
// texture, but on a real forehead it pulled a sharp, pointed dark spike
// down into the skin instead of lowering a band of hairline (seen on real
// camera footage: a single downward-pointing V, not a shifted boundary).
// Spread across a horizontal band instead — same anchor, multiple points —
// so it reuses the existing max-weight-across-points falloff (no shader/
// CPU changes needed, see getDeformationZones). Width is a reasoned
// geometric choice, not a clinical figure: half the interocular distance
// on each side keeps it inside the central forehead, short of the
// Temporal points' own territory.
const CENTRAL_HALF_WIDTH_RATIO = 0.3
const CENTRAL_WIDTH_STEPS = [-1, -0.5, 0, 0.5, 1]

// Verified (metric space, mock scan data) as eye-outer-corner-to-temporal
// -point offset ÷ interocular distance ≈ (0.213, 0.448, -0.181) right /
// (0.199, 0.448, -0.196) left — averaged since real faces are near-symmetric.
// Same fix as Central: the raw landmarks this used to read (54/284, "topmost
// face-oval vertices short of FOREHEAD_TOP") sit almost as close to the top
// edge of MediaPipe's tracked region as index 10 itself (verified: y=0.27 vs
// 0.22 in raw frame coords, both far closer to the crop/occlusion-prone edge
// than glabella's 0.35) — same live-tracking reliability problem Central was
// already fixed for, just less extreme. The eye outer corner has none of
// that risk, so deriving from it the same self-scaling way fixes both points
// for the same reason.
const TEMPORAL_OUTWARD_RATIO = 0.206
const TEMPORAL_UP_RATIO = 0.448
const TEMPORAL_FORWARD_RATIO = -0.189

/**
 * MediaPipe's mesh has no hair/scalp geometry, so hairline lowering is
 * approximated as advancing the visible forehead-skin boundary: Central
 * (for a uniformly high forehead) and Temporal per side (for a receded
 * corner/M-shape, the more common standalone complaint) — a proxy for the
 * surgical effect, not a rendering of hair.
 */
export const HAIRLINE_REGIONS: FaceRegion[] = [
  {
    id: 'hairline-central',
    label: 'Central Advancement',
    // Extrapolated up from glabella (between the eyebrows) rather than
    // read directly from the forehead-top landmark: index 10 sits at the
    // very top edge of MediaPipe's tracked face region, live tracking's
    // least reliable spot — the first point a close/low camera crops, and
    // the one most often degraded by hair or bangs. Glabella has none of
    // those problems (central, high-contrast, essentially never occluded).
    getAnchors: (landmarks) => {
      const glabella = landmarks[GLABELLA]
      const interocular = distance(landmarks[EYE_OUTER_CORNER_RIGHT], landmarks[EYE_OUTER_CORNER_LEFT])
      const y = glabella.y + interocular * CENTRAL_OFFSET_RATIO
      const halfWidth = interocular * CENTRAL_HALF_WIDTH_RATIO
      return CENTRAL_WIDTH_STEPS.map((t) => ({ x: glabella.x + t * halfWidth, y, z: glabella.z }))
    },
  },
  {
    id: 'hairline-temporal-right',
    label: 'Temporal Point',
    side: 'right',
    getAnchors: (landmarks) => {
      const eyeOuter = landmarks[EYE_OUTER_CORNER_RIGHT]
      const interocular = distance(landmarks[EYE_OUTER_CORNER_RIGHT], landmarks[EYE_OUTER_CORNER_LEFT])
      return [
        {
          x: eyeOuter.x - interocular * TEMPORAL_OUTWARD_RATIO,
          y: eyeOuter.y + interocular * TEMPORAL_UP_RATIO,
          z: eyeOuter.z + interocular * TEMPORAL_FORWARD_RATIO,
        },
      ]
    },
  },
  {
    id: 'hairline-temporal-left',
    label: 'Temporal Point',
    side: 'left',
    getAnchors: (landmarks) => {
      const eyeOuter = landmarks[EYE_OUTER_CORNER_LEFT]
      const interocular = distance(landmarks[EYE_OUTER_CORNER_RIGHT], landmarks[EYE_OUTER_CORNER_LEFT])
      return [
        {
          x: eyeOuter.x + interocular * TEMPORAL_OUTWARD_RATIO,
          y: eyeOuter.y + interocular * TEMPORAL_UP_RATIO,
          z: eyeOuter.z + interocular * TEMPORAL_FORWARD_RATIO,
        },
      ]
    },
  },
]
