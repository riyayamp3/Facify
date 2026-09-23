import { angularDelta } from '../math/headPose'
import type { HeadPose, Vec3 } from '../types/face'

const STABILITY_WINDOW_MS = 400
const MAX_STABLE_ANGULAR_VELOCITY = 30 // degrees/sec summed across yaw+pitch+roll

interface PoseSample {
  pose: HeadPose
  timestampMs: number
}

/** Tracks recent head-pose samples to decide whether the head has stopped moving. */
export class StabilityTracker {
  private samples: PoseSample[] = []

  push(pose: HeadPose, timestampMs: number) {
    this.samples.push({ pose, timestampMs })
    const cutoff = timestampMs - STABILITY_WINDOW_MS
    this.samples = this.samples.filter((s) => s.timestampMs >= cutoff)
  }

  /** Degrees/sec of total angular movement over the rolling window, or null if not enough data yet. */
  velocity(): number | null {
    if (this.samples.length < 3) return null
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const dtSec = (last.timestampMs - first.timestampMs) / 1000
    if (dtSec <= 0) return null

    let totalDelta = 0
    for (let i = 1; i < this.samples.length; i++) {
      totalDelta += angularDelta(this.samples[i - 1].pose, this.samples[i].pose)
    }
    return totalDelta / dtSec
  }

  isStable(): boolean {
    const v = this.velocity()
    return v !== null && v < MAX_STABLE_ANGULAR_VELOCITY
  }
}

export function landmarkBoundingBox(landmarks: Vec3[], videoWidth: number, videoHeight: number) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of landmarks) {
    const x = p.x * videoWidth
    const y = p.y * videoHeight
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

const sharpnessCanvas = document.createElement('canvas')
const SHARPNESS_SIZE = 64
sharpnessCanvas.width = SHARPNESS_SIZE
sharpnessCanvas.height = SHARPNESS_SIZE
const sharpnessCtx = sharpnessCanvas.getContext('2d', { willReadFrequently: true })

export const MIN_SHARPNESS_VARIANCE = 1.5
export const MIN_BRIGHTNESS = 40 // mean 0-255 grayscale; below this, "try better lighting"

export interface FrameQuality {
  variance: number
  meanBrightness: number
}

/**
 * Cheap variance-of-Laplacian blur estimate + mean brightness on a
 * downsampled crop of the face region, computed from a single canvas
 * read so we don't pay for two pixel-readback passes per frame. Returns
 * null if it can't be computed (bad bbox / no 2d context) — callers
 * should treat null as "can't tell, don't block on it."
 */
export function computeFrameQuality(video: HTMLVideoElement, landmarks: Vec3[]): FrameQuality | null {
  if (!sharpnessCtx) return null

  const { minX, minY, maxX, maxY } = landmarkBoundingBox(landmarks, video.videoWidth, video.videoHeight)
  const w = maxX - minX
  const h = maxY - minY
  if (w <= 0 || h <= 0) return null

  sharpnessCtx.drawImage(video, minX, minY, w, h, 0, 0, SHARPNESS_SIZE, SHARPNESS_SIZE)
  const { data } = sharpnessCtx.getImageData(0, 0, SHARPNESS_SIZE, SHARPNESS_SIZE)

  const gray = new Float32Array(SHARPNESS_SIZE * SHARPNESS_SIZE)
  let brightnessSum = 0
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4
    const g = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
    gray[i] = g
    brightnessSum += g
  }

  let sum = 0
  let sumSq = 0
  let count = 0
  for (let y = 1; y < SHARPNESS_SIZE - 1; y++) {
    for (let x = 1; x < SHARPNESS_SIZE - 1; x++) {
      const idx = y * SHARPNESS_SIZE + x
      const laplacian =
        4 * gray[idx] -
        gray[idx - 1] -
        gray[idx + 1] -
        gray[idx - SHARPNESS_SIZE] -
        gray[idx + SHARPNESS_SIZE]
      sum += laplacian
      sumSq += laplacian * laplacian
      count++
    }
  }
  const mean = sum / count
  return {
    variance: sumSq / count - mean * mean,
    meanBrightness: brightnessSum / gray.length,
  }
}
