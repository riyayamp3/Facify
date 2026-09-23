import type { CapturedFrame, Vec3 } from '../types/face'
import { imageLandmarksToMetric } from './landmarkSpace'
import { applyMat3Transpose, rotationMatrixFromPose } from './rotationMatrix'

function centroid(points: Vec3[]): Vec3 {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
    { x: 0, y: 0, z: 0 },
  )
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length }
}

/**
 * Converts a captured frame's landmarks into a pose-normalized canonical
 * space: metric coordinates, recentered on the landmark centroid, with
 * the frame's head rotation undone. A frame captured while the head was
 * turned should land close to the same coordinates as one captured
 * facing forward — this is what separates "pose change" from "geometric
 * change" (brief section 8/32).
 */
export function toCanonicalSpace(frame: CapturedFrame): Vec3[] {
  const metric = imageLandmarksToMetric(frame.landmarks, frame.frameSize)
  const center = centroid(metric)
  const rotation = rotationMatrixFromPose(frame.pose)

  return metric.map((p) => {
    const centered: Vec3 = { x: p.x - center.x, y: p.y - center.y, z: p.z - center.z }
    return applyMat3Transpose(rotation, centered)
  })
}
