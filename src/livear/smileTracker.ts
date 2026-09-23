import { EYE_OUTER_CORNER_LEFT, EYE_OUTER_CORNER_RIGHT, MOUTH_CORNER_LEFT, MOUTH_CORNER_RIGHT } from '../anatomy/landmarkGroups'
import { distance } from '../math/vec3'
import type { Vec3 } from '../types/face'

/**
 * Real dimpleplasty creates a dermis-to-muscle adhesion that only pulls
 * the skin inward when the buccinator contracts — i.e. while smiling.
 * Surgeons explicitly mark and verify the result "at rest and smiling"
 * for exactly this reason (a dimple that showed the same at rest as
 * smiling wouldn't read as a real one). A constant, expression-
 * independent pull is less anatomically accurate than modeling that: this
 * tracks how much the mouth has widened relative to its own recent
 * neutral baseline, so the simulated depth can scale the same way the
 * real adhesion does — negligible at rest, full depth at a genuine smile.
 *
 * The baseline is a "leaky" rolling minimum of mouth-width/interocular
 * ratio (both live measurements, so this is scale-invariant the same way
 * the deformation constants are): it snaps down instantly on a more
 * relaxed frame (that's more neutral than anything seen yet, by
 * definition), but also drifts back up slowly if the face never fully
 * relaxes, so someone smiling from the very first tracked frame doesn't
 * stay permanently pinned at "baseline = that smile" and read as
 * perpetually neutral relative to it.
 *
 * The rise has to stay far slower than a real smile actually forms (well
 * under a second, typically held for a few seconds) — the whole point of
 * the drift is to eventually recalibrate to a *sustained* neutral over
 * many seconds, not to chase a smile while it's still happening. An
 * earlier version at 0.05/s rose fast enough to cancel out most of a
 * 2-second smile ramp *during* the ramp itself, defeating the tracker
 * almost entirely — caught by simulating a smile in the debug harness and
 * seeing the "full smile" screenshot come back with barely any dimple.
 */
const BASELINE_RISE_PER_SECOND = 0.006
// Ratio increase from a relaxed mouth to a full smile — a reasoned
// starting estimate (typical smiles widen the mouth by a few tenths of
// the interocular distance), not measured against real tracking data
// since this sandbox has no camera. Tune down if the dimple maxes out
// before a real smile feels "full"; tune up if it never reaches full depth.
const SMILE_RANGE = 0.22

export class SmileTracker {
  private baseline = Infinity
  private lastT: number | null = null

  /** Returns smile intensity in [0, 1] — 0 at rest, 1 at a full smile. */
  next(landmarks: Vec3[], t = performance.now()): number {
    const mouthWidth = distance(landmarks[MOUTH_CORNER_RIGHT], landmarks[MOUTH_CORNER_LEFT])
    const interocular = distance(landmarks[EYE_OUTER_CORNER_RIGHT], landmarks[EYE_OUTER_CORNER_LEFT])
    const ratio = mouthWidth / (interocular || 1)

    if (this.lastT === null) {
      this.baseline = ratio
    } else {
      const dt = Math.max(0, (t - this.lastT) / 1000)
      this.baseline = Math.min(ratio, this.baseline + BASELINE_RISE_PER_SECOND * dt)
    }
    this.lastT = t

    return Math.max(0, Math.min(1, (ratio - this.baseline) / SMILE_RANGE))
  }

  reset() {
    this.baseline = Infinity
    this.lastT = null
  }
}
