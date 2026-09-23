import type { HeadPose } from '../types/face'

export interface MediaPipeMatrix {
  rows: number
  columns: number
  data: number[] | Float32Array
}

const RAD_TO_DEG = 180 / Math.PI

/**
 * MediaPipe's facialTransformationMatrix is COLUMN-MAJOR (documented by
 * the face_geometry module as OpenGL-style, so it can be used directly
 * as a model matrix) — data[col*rows + row], not data[row*columns + col].
 * Reading it row-major silently transposes the rotation, which mostly
 * cancels out and makes yaw barely move no matter how far the head turns.
 */
function at(m: MediaPipeMatrix, row: number, col: number): number {
  return m.data[col * m.rows + row]
}

/**
 * Extracts yaw/pitch/roll (degrees) from a rotation matrix by reading off
 * the canonical face model's local Z axis (its "R02,R12,R22" column) in
 * camera space and converting that direction to spherical angles. This
 * is Euler-order-independent (unlike atan2(r10,r00)-style formulas,
 * which assume a specific composition order and silently return near-zero
 * yaw for MediaPipe's Y-up/Z-toward-viewer face space if that assumption
 * is wrong). Good enough for scan gating — not used for geometry.
 */
export function poseFromTransformationMatrix(matrix: MediaPipeMatrix): HeadPose {
  const r02 = at(matrix, 0, 2)
  const r12 = at(matrix, 1, 2)
  const r22 = at(matrix, 2, 2)
  const r10 = at(matrix, 1, 0)
  const r11 = at(matrix, 1, 1)

  const yaw = Math.atan2(r02, r22) * RAD_TO_DEG
  const pitch = Math.atan2(-r12, Math.sqrt(r02 * r02 + r22 * r22)) * RAD_TO_DEG
  const roll = Math.atan2(r10, r11) * RAD_TO_DEG

  return { yaw, pitch, roll }
}

export function angularDelta(a: HeadPose, b: HeadPose): number {
  return Math.abs(a.yaw - b.yaw) + Math.abs(a.pitch - b.pitch) + Math.abs(a.roll - b.roll)
}
