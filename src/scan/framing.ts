import type { Vec3 } from '../types/face'
import { landmarkBoundingBox } from './scanQuality'

export type FramingIssue = 'move-closer' | 'move-back' | 'center' | null

export interface FramingResult {
  issue: FramingIssue
  ok: boolean
}

const MIN_FACE_WIDTH_RATIO = 0.22 // face too small / user too far back
const MAX_FACE_WIDTH_RATIO = 0.75 // face too large / user too close
const MAX_CENTER_OFFSET_RATIO = 0.16 // face center vs. frame center, as a fraction of frame width

/**
 * Checks whether the detected face is reasonably centered and sized
 * within the frame, so we can guide the user before even attempting a
 * capture ("move closer", "center yourself") instead of just failing
 * silently on a bad framing.
 */
export function evaluateFraming(landmarks: Vec3[], videoWidth: number, videoHeight: number): FramingResult {
  const { minX, minY, maxX, maxY } = landmarkBoundingBox(landmarks, videoWidth, videoHeight)
  const faceWidth = maxX - minX
  const faceCenterX = (minX + maxX) / 2
  const faceCenterY = (minY + maxY) / 2

  const widthRatio = faceWidth / videoWidth
  const offsetX = Math.abs(faceCenterX - videoWidth / 2) / videoWidth
  const offsetY = Math.abs(faceCenterY - videoHeight / 2) / videoHeight

  if (widthRatio < MIN_FACE_WIDTH_RATIO) return { issue: 'move-closer', ok: false }
  if (widthRatio > MAX_FACE_WIDTH_RATIO) return { issue: 'move-back', ok: false }
  if (offsetX > MAX_CENTER_OFFSET_RATIO || offsetY > MAX_CENTER_OFFSET_RATIO) {
    return { issue: 'center', ok: false }
  }
  return { issue: null, ok: true }
}
