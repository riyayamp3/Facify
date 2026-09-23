import type { HeadPose, Vec3 } from '../types/face'

/** Row-major 3x3: [r00,r01,r02, r10,r11,r12, r20,r21,r22]. */
export type Mat3 = [number, number, number, number, number, number, number, number, number]

const DEG_TO_RAD = Math.PI / 180

/**
 * Builds R = Ry(yaw) * Rx(pitch) * Rz(roll) — the exact forward
 * composition that headPose.ts's poseFromTransformationMatrix decomposes
 * (see its r02/r12/r22/r10/r11 formulas). Reconstructing R from the
 * angles it was decomposed from is the algebraic inverse of that
 * extraction, not an independent approximation.
 */
export function rotationMatrixFromPose(pose: HeadPose): Mat3 {
  const yaw = pose.yaw * DEG_TO_RAD
  const pitch = pose.pitch * DEG_TO_RAD
  const roll = pose.roll * DEG_TO_RAD

  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const cr = Math.cos(roll)
  const sr = Math.sin(roll)

  return [
    cy * cr + sy * sp * sr, -cy * sr + sy * sp * cr, sy * cp,
    cp * sr, cp * cr, -sp,
    -sy * cr + cy * sp * sr, sy * sr + cy * sp * cr, cy * cp,
  ]
}

export function applyMat3(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  }
}

/** Applies m^T, which equals m^-1 for a rotation matrix — undoes the rotation m represents. */
export function applyMat3Transpose(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[3] * v.y + m[6] * v.z,
    y: m[1] * v.x + m[4] * v.y + m[7] * v.z,
    z: m[2] * v.x + m[5] * v.y + m[8] * v.z,
  }
}
