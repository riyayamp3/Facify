import type { ScanLeg } from '../types/face'

export const SCAN_LEG_ORDER: ScanLeg[] = ['front', 'left', 'right']

const FRONT_MAX_ABS_YAW = 12
const SIDE_MIN_ABS_YAW = 15

/**
 * A wide, generous zone per leg with a small dead zone between them (12
 * to 15 degrees) to avoid flicker at the boundary. No upper bound on the
 * side zones — anything from a slight turn to a full profile counts, so
 * a fast/large turn still lands in a valid zone instead of overshooting
 * a narrow target band.
 */
export function zoneForYaw(yaw: number): ScanLeg | null {
  if (Math.abs(yaw) <= FRONT_MAX_ABS_YAW) return 'front'
  if (yaw <= -SIDE_MIN_ABS_YAW) return 'left'
  if (yaw >= SIDE_MIN_ABS_YAW) return 'right'
  return null
}
