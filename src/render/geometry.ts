import * as THREE from 'three'
import type { Vec3 } from '../types/face'
import { FACE_MESH_TRIANGLES } from './faceTopology'

const FACE_MESH_VERTEX_COUNT = 468

/**
 * Builds a Three.js mesh geometry from already-canonical (metric,
 * pose-normalized, centroid-centered) landmarks. Only the first 468
 * points are used — indices 468+ are the iris refinement points, which
 * the base topology doesn't reference.
 */
export function buildFaceGeometry(vertices: Vec3[]): THREE.BufferGeometry {
  const positions = new Float32Array(FACE_MESH_VERTEX_COUNT * 3)
  for (let i = 0; i < FACE_MESH_VERTEX_COUNT; i++) {
    const p = vertices[i]
    positions[i * 3] = p.x
    positions[i * 3 + 1] = p.y
    positions[i * 3 + 2] = p.z
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(FACE_MESH_TRIANGLES)
  geometry.computeVertexNormals()
  return geometry
}
