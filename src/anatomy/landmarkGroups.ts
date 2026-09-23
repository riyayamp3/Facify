/**
 * MediaPipe face mesh contour index groups, fetched from the official
 * source (mediapipe/python/solutions/face_mesh_connections.py) rather
 * than reconstructed from memory, then cross-checked by plotting them on
 * the canonical face model. "LEFT"/"RIGHT" follow MediaPipe's own
 * convention (the subject's anatomical left/right, not screen side).
 */

export const LIPS = [
  0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95, 146, 178,
  181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314, 317, 318, 321,
  324, 375, 402, 405, 409, 415,
]

export const LEFT_EYE = [
  249, 263, 362, 373, 374, 380, 381, 382, 384, 385, 386, 387, 388, 390, 398, 466,
]

export const RIGHT_EYE = [
  7, 33, 133, 144, 145, 153, 154, 155, 157, 158, 159, 160, 161, 163, 173, 246,
]

export const LEFT_EYEBROW = [276, 282, 283, 285, 293, 295, 296, 300, 334, 336]
export const RIGHT_EYEBROW = [46, 52, 53, 55, 63, 65, 66, 70, 105, 107]

// Each eyebrow split into lateral (outer/temple, further from midline) and
// medial (inner/nose) halves, verified by x-coordinate in canonical space
// this session. Real brow lift technique distinguishes these — lateral
// hooding is the far more common complaint than medial ptosis.
//
// Upper-row points ONLY (MediaPipe's brow contour is a ribbon — upper and
// lower boundary — and these are just the upper one), verified this
// session as a single smooth, monotonic-x arc with no zigzag: RIGHT =
// [70, 63, 105, 66, 107], LEFT its mirror-by-position = [300, 293, 334,
// 296, 336]. The full 10-point ribbon (both rows) was tried first, two
// ways: connected as one path (zigzagged between the rows — a visibly
// wavy lift) and as independent per-point falloff (no zigzag, but 5
// separate bump sources create their own "beads on a string" ripple
// unless the radius is generous enough to fully merge them into one
// ridge, which it wasn't at typical settings — verified 4 separate local
// maxima along the sweep). A path over just the upper row's 5 points
// avoids both: one row, so no zigzag; a path (distance to nearest
// SEGMENT), so no per-point seams — see deformFace.ts's brow-lift zone
// push and radialField.ts's applyRadialDeformationPathWeighted.
export const RIGHT_EYEBROW_LATERAL = [70, 63, 105]
export const RIGHT_EYEBROW_MEDIAL = [66, 107]
export const LEFT_EYEBROW_LATERAL = [300, 293, 334]
export const LEFT_EYEBROW_MEDIAL = [296, 336]

export const FACE_OVAL = [
  10, 21, 54, 58, 67, 93, 103, 109, 127, 132, 136, 148, 149, 150, 152, 162,
  172, 176, 234, 251, 284, 288, 297, 323, 332, 338, 356, 361, 365, 377, 378,
  379, 389, 397, 400, 454,
]

export const NOSE = [
  1, 2, 4, 5, 6, 19, 45, 48, 64, 94, 97, 98, 115, 168, 195, 197, 220, 275,
  278, 294, 326, 327, 344, 440,
]

// A handful of individually well-known, frequently-reused landmarks.
export const MOUTH_CORNER_RIGHT = 61
export const MOUTH_CORNER_LEFT = 291
export const EYE_OUTER_CORNER_RIGHT = 33
export const EYE_OUTER_CORNER_LEFT = 263
export const NOSE_BASE_CENTER = 2 // columella base, midline
export const UPPER_LIP_TOP_CENTER = 0 // cupid's bow peak, midline — the vermilion border
// Upper-lip vermilion border, corner to corner (verified smooth arc:
// 61 -> ... -> 0 (cupid's bow peak) -> ... -> 291).
export const UPPER_LIP_BORDER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 291]
export const CHEEK_OVAL_RIGHT = 132 // face-oval point at ~nose height
export const CHEEK_OVAL_LEFT = 361
// Posterior/lower face-oval point, closer to the ear — used as a pull
// direction for the buccal extension anchor (further back toward the
// masseter than the main body). Not used directly as an anchor itself.
export const POSTERIOR_CHEEK_RIGHT = 234
export const POSTERIOR_CHEEK_LEFT = 454
export const NOSE_TIP = 4

// Added for facial-analysis measurements (analysis/measurements.ts). All
// verified in canonical space this session: symmetric pairs sit at x=0
// mirror, and vertical (y) ordering matches real anatomy (forehead >
// glabella > nasion > canthi > nose tip > subnasale > lips > chin).
export const FOREHEAD_TOP = 10 // trichion/hairline PROXY — MediaPipe doesn't track hair
export const GLABELLA = 8 // smooth point between the brows, just above nasion
export const NASION = 168 // nasal root, between the eyes
export const INNER_CANTHUS_RIGHT = 133
export const INNER_CANTHUS_LEFT = 362
export const FACE_WIDTH_RIGHT = 234 // same landmark as POSTERIOR_CHEEK_RIGHT, named for its use here
export const FACE_WIDTH_LEFT = 454
export const CHIN = 152
export const NASAL_ALA_RIGHT = 98
export const NASAL_ALA_LEFT = 327
export const STOMION_UPPER = 13 // inner upper-lip edge, midline — brackets the mouth opening with 14
export const STOMION_LOWER = 14
export const LOWER_LIP_BOTTOM_CENTER = 17
