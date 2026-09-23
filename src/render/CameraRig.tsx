import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

const RADIUS = 2.4
const EASE = 0.08
const MIN_DISTANCE = 1.2
const MAX_DISTANCE = 4

interface CameraRigProps {
  targetYawDeg: number
  /** Lets the user zoom/pan with the mouse (scroll to zoom, drag to pan). Off by
   * default because Simulation's click/drag-to-place anchors need the canvas's
   * pointer events uncontested. */
  interactive?: boolean
}

/**
 * Orbits the camera around a fixed face model at a given yaw angle. The
 * mesh itself never moves — only the camera does — so switching presets
 * can't be mistaken for a geometric change in the face.
 */
export function CameraRig({ targetYawDeg, interactive = false }: CameraRigProps) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const currentYawRad = useRef(0)

  useFrame(() => {
    const targetRad = THREE.MathUtils.degToRad(targetYawDeg)
    currentYawRad.current = THREE.MathUtils.lerp(currentYawRad.current, targetRad, EASE)

    const controls = controlsRef.current
    const target = controls?.target ?? new THREE.Vector3(0, 0, 0)
    // Read the live distance so any mouse-driven zoom is preserved across yaw changes.
    const distance = controls ? camera.position.distanceTo(target) : RADIUS

    camera.position.set(
      target.x + distance * Math.sin(currentYawRad.current),
      target.y + 0.05,
      target.z + distance * Math.cos(currentYawRad.current),
    )
    if (controls) controls.update()
    else camera.lookAt(0, 0, 0)
  })

  if (!interactive) return null

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate={false}
      enableZoom
      enablePan
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  )
}
