import type { Vec3 } from '../types/face'

/**
 * Converts MediaPipe's normalized landmarks (x,y in 0..1 relative to the
 * captured frame, z roughly on the same scale) into a metric, y-up space.
 * Shared by rendering (geometry.ts) and pose normalization
 * (canonicalSpace.ts) so there's exactly one definition of this mapping.
 */
export function imageLandmarksToMetric(
  landmarks: Vec3[],
  frameSize: { width: number; height: number },
): Vec3[] {
  const aspect = frameSize.width / frameSize.height
  return landmarks.map((p) => ({
    x: (p.x - 0.5) * aspect,
    y: -(p.y - 0.5),
    z: -p.z * aspect,
  }))
}

/**
 * Exact inverse of imageLandmarksToMetric — used by Live AR to convert
 * deformed metric-space points back into normalized image coordinates for
 * on-screen placement over the live video.
 */
export function metricToImageLandmarks(
  points: Vec3[],
  frameSize: { width: number; height: number },
): Vec3[] {
  const aspect = frameSize.width / frameSize.height
  return points.map((p) => ({
    x: p.x / aspect + 0.5,
    y: -p.y + 0.5,
    z: -p.z / aspect,
  }))
}
