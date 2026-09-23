import type { Vec3 } from '../types/face'

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function length(v: Vec3): number {
  return Math.sqrt(dot(v, v))
}

export function distance(a: Vec3, b: Vec3): number {
  return length(subtract(a, b))
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v) || 1
  return scale(v, 1 / len)
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return scale(add(a, b), 0.5)
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return add(a, scale(subtract(b, a), t))
}

/** Angle in degrees at vertex `b`, between rays to `a` and `c`. */
export function angleAt(a: Vec3, b: Vec3, c: Vec3): number {
  const u = subtract(a, b)
  const v = subtract(c, b)
  const cos = dot(u, v) / ((length(u) * length(v)) || 1)
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
}

/** Signed 3D perpendicular distance from `p` to the line through `a`-`b` (positive = `p` is in front, i.e. larger z, than its closest point on the line). Used for profile measurements like the E-line, where distance must be measured in the sagittal plane, not the frontal one. */
export function signedDistanceToLine(p: Vec3, a: Vec3, b: Vec3): number {
  const lineDir = normalize(subtract(b, a))
  const toPoint = subtract(p, a)
  const alongLine = scale(lineDir, dot(toPoint, lineDir))
  const closest = add(a, alongLine)
  const perpLen = distance(p, closest)
  return p.z >= closest.z ? perpLen : -perpLen
}
