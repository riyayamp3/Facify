import type { Vec3 } from '../types/face'

/**
 * One Euro Filter (Casiez, Roussel & Vogel, 2012) — the standard adaptive
 * filter for exactly this problem (noisy real-time position tracking that
 * needs both stability and responsiveness). A fixed-rate EMA sits at one
 * point on the jitter-vs-lag trade-off: slow enough to kill jitter and
 * you get visible lag on fast head motion, fast enough to track motion
 * and jitter comes back. One Euro adapts its own cutoff from the signal's
 * velocity — heavy smoothing when nearly still (jitter dominates), light
 * smoothing when moving fast (lag would dominate instead), so it gets
 * closer to both at once instead of trading one for the other.
 */
class LowPassFilter {
  private y: number | null = null

  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y
    return this.y
  }

  reset() {
    this.y = null
  }
}

function computeAlpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

class OneEuroFilter1D {
  private xFilter = new LowPassFilter()
  private dxFilter = new LowPassFilter()
  private lastX: number | null = null
  private lastT: number | null = null
  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutoff: number

  constructor(minCutoff: number, beta: number, dCutoff = 1.0) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  filter(x: number, tMs: number): number {
    if (this.lastT === null) {
      this.lastT = tMs
      this.lastX = x
      return this.xFilter.filter(x, 1)
    }
    const dt = Math.max(1e-3, (tMs - this.lastT) / 1000)
    this.lastT = tMs
    const dx = (x - (this.lastX ?? x)) / dt
    this.lastX = x
    const edx = this.dxFilter.filter(dx, computeAlpha(this.dCutoff, dt))
    const cutoff = this.minCutoff + this.beta * Math.abs(edx)
    return this.xFilter.filter(x, computeAlpha(cutoff, dt))
  }

  reset() {
    this.xFilter.reset()
    this.dxFilter.reset()
    this.lastX = null
    this.lastT = null
  }
}

/**
 * Applies an independent One Euro Filter per landmark per axis (1404
 * scalar channels for 468 landmarks). `beta` is tuned for our normalized
 * [0,1] image-space coordinates (the filter's cutoff scales with the
 * signal's own units, so the usual pixel-space defaults — e.g. beta~0.007
 * — would barely react at this ~1/1000th scale).
 *
 * minCutoff=1.0/beta=10 was the initial starting point (not measured
 * against real tracking data, since this sandbox has no camera — reasoned
 * from unit scale alone). Real-camera feedback: the warp visibly trails
 * behind the face while the head is moving. That's the video texture
 * (zero added latency, always the current frame) against a deformation
 * field built from these filtered landmarks, which lag a few frames
 * behind during motion by construction — the whole point of the adaptive
 * cutoff is to shrink that lag as speed increases, so if it's still
 * visible, the response just isn't ramping up fast enough. Raised beta
 * 10 -> 40 (bigger cutoff boost per unit of velocity, less lag once
 * moving) and minCutoff 1.0 -> 1.6 (higher floor, less lag in the first
 * moment motion starts, before the velocity estimate has caught up) —
 * trades a bit more jitter at rest for less lag in motion, matching what
 * was actually reported. Another reasoned adjustment pending further
 * real-camera feedback, same as every other Live AR constant tuned this
 * session.
 *
 * `heavySmoothingIndices` get a lower minCutoff/beta than the rest: points
 * right at the edge of MediaPipe's face region (forehead-top, temples —
 * used by Hairline Lowering) are tracked with less confidence than
 * central features like the eyes or nose, since the model has a weaker,
 * more occlusion-prone signal to work with there (hair, hat brims, frame
 * edge). More filtering trades a bit more lag specifically on those points
 * for noticeably less jitter, without slowing down every other procedure's
 * responsiveness.
 */
export class LandmarkSmoother {
  private filtersX: OneEuroFilter1D[] = []
  private filtersY: OneEuroFilter1D[] = []
  private filtersZ: OneEuroFilter1D[] = []
  private readonly minCutoff: number
  private readonly beta: number
  private readonly heavyMinCutoff: number
  private readonly heavyBeta: number
  private readonly heavySmoothingIndices: Set<number>

  constructor(
    minCutoff = 1.6,
    beta = 40,
    heavySmoothingIndices: number[] = [],
    heavyMinCutoff = 0.3,
    heavyBeta = 3,
  ) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.heavySmoothingIndices = new Set(heavySmoothingIndices)
    this.heavyMinCutoff = heavyMinCutoff
    this.heavyBeta = heavyBeta
  }

  next(raw: Vec3[]): Vec3[] {
    const t = performance.now()
    if (this.filtersX.length !== raw.length) {
      const make = (i: number) =>
        this.heavySmoothingIndices.has(i)
          ? new OneEuroFilter1D(this.heavyMinCutoff, this.heavyBeta)
          : new OneEuroFilter1D(this.minCutoff, this.beta)
      this.filtersX = raw.map((_, i) => make(i))
      this.filtersY = raw.map((_, i) => make(i))
      this.filtersZ = raw.map((_, i) => make(i))
    }
    return raw.map((p, i) => ({
      x: this.filtersX[i].filter(p.x, t),
      y: this.filtersY[i].filter(p.y, t),
      z: this.filtersZ[i].filter(p.z, t),
    }))
  }

  reset() {
    for (const f of this.filtersX) f.reset()
    for (const f of this.filtersY) f.reset()
    for (const f of this.filtersZ) f.reset()
  }
}
