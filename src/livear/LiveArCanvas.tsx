import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { EYE_OUTER_CORNER_LEFT, EYE_OUTER_CORNER_RIGHT } from '../anatomy/landmarkGroups'
import type { RegionSide } from '../anatomy/regions'
import { imageLandmarksToMetric } from '../math/landmarkSpace'
import { distance } from '../math/vec3'
import { getDeformationZones, REFERENCE_INTEROCULAR, type ProcedureParams } from '../simulation/deformFace'
import type { Vec3 } from '../types/face'
import { resolveAnchoredPoint, type FaceAnchoredPoint } from './faceAnchoredPoint'
import { LandmarkSmoother } from './oneEuroFilter'
import { SmileTracker } from './smileTracker'
import { computeContainRect, computeMetricToWorld, screenToWorld, type DisplayRect } from './viewportMapping'
import { createWarpMaterial, updateWarpUniforms } from './warpShader'

const FACE_MESH_VERTEX_COUNT = 468
// If tracking briefly glitches (blink, partial occlusion, motion blur) the
// live interocular distance can spike or collapse for a frame — clamp the
// resulting scale factor so a bad frame can't produce a wildly over- or
// under-sized effect.
const MIN_SCALE_FACTOR = 0.5
const MAX_SCALE_FACTOR = 2.0

function centroid(points: Vec3[]): Vec3 {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), {
    x: 0,
    y: 0,
    z: 0,
  })
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length }
}

interface LiveArSceneProps {
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  getLandmarks: () => Vec3[] | null
  frameSize: { width: number; height: number }
  containerSize: { width: number; height: number }
  rect: DisplayRect
  paramsRef: React.RefObject<ProcedureParams>
  dimpleAnchorsRef: React.RefObject<Partial<Record<RegionSide, FaceAnchoredPoint>>>
  onFaceDetectedChange?: (detected: boolean) => void
}

function LiveArScene({
  source,
  getLandmarks,
  frameSize,
  containerSize,
  rect,
  paramsRef,
  dimpleAnchorsRef,
  onFaceDetectedChange,
}: LiveArSceneProps) {
  // Hairline's anchors (Central, Temporal) are both now derived from
  // glabella/eye-outer-corner (see hairlineRegions.ts) — reliable, central
  // landmarks — so no per-index heavy smoothing is needed anymore. Uses
  // LandmarkSmoother's own defaults (see oneEuroFilter.ts) rather than
  // repeating them here, so there's one place tuning this actually changes.
  const smootherRef = useRef(new LandmarkSmoother())
  const smileTrackerRef = useRef(new SmileTracker())
  const wasDetectedRef = useRef(false)

  const texture = useMemo(() => new THREE.VideoTexture(source as HTMLVideoElement), [source])
  useEffect(() => () => texture.dispose(), [texture])

  const material = useMemo(() => createWarpMaterial(texture), [texture])
  useEffect(() => () => material.dispose(), [material])

  const aspect = frameSize.width / frameSize.height || 1
  const metricToWorld = useMemo(
    () => computeMetricToWorld(rect, containerSize, aspect),
    [rect, containerSize, aspect],
  )

  useFrame(() => {
    texture.needsUpdate = true
    const raw = getLandmarks()
    if (!raw) {
      if (wasDetectedRef.current) {
        wasDetectedRef.current = false
        onFaceDetectedChange?.(false)
        smootherRef.current.reset()
        smileTrackerRef.current.reset()
      }
      material.uniforms.uZoneCount.value = 0
      return
    }
    if (!wasDetectedRef.current) {
      wasDetectedRef.current = true
      onFaceDetectedChange?.(true)
    }

    const face = raw.slice(0, FACE_MESH_VERTEX_COUNT)
    const smoothed = smootherRef.current.next(face)

    const metric = imageLandmarksToMetric(smoothed, frameSize)
    const faceCenter = centroid(metric)

    const liveInterocular = distance(metric[EYE_OUTER_CORNER_RIGHT], metric[EYE_OUTER_CORNER_LEFT])
    const scaleFactor = Math.min(
      MAX_SCALE_FACTOR,
      Math.max(MIN_SCALE_FACTOR, liveInterocular / REFERENCE_INTEROCULAR),
    )

    // dimplePositions in paramsRef is a frame-relative snapshot from click
    // time (stale the instant the face moves) — re-derive the live
    // position every frame from its anchored landmark instead.
    const anchors = dimpleAnchorsRef.current
    const liveDimplePositions = {
      right: anchors.right ? resolveAnchoredPoint(anchors.right, metric, liveInterocular) : undefined,
      left: anchors.left ? resolveAnchoredPoint(anchors.left, metric, liveInterocular) : undefined,
    }

    // A real surgical dimple only shows when the buccinator contracts
    // during a smile — a constant pull regardless of expression is less
    // accurate than that. The depth slider sets the target at a full
    // smile; live intensity scales how much of it actually shows right now.
    const smileIntensity = smileTrackerRef.current.next(metric)
    const liveDimpleDepth = Object.fromEntries(
      Object.entries(paramsRef.current.dimpleDepth).map(([side, depth]) => [side, depth * smileIntensity]),
    )

    const liveParams: ProcedureParams = {
      ...paramsRef.current,
      dimplePositions: liveDimplePositions,
      dimpleDepth: liveDimpleDepth,
    }

    const zones = getDeformationZones(metric, liveParams, faceCenter, scaleFactor)

    updateWarpUniforms(material, zones, metricToWorld.scale, metricToWorld.offset, aspect)
  })

  const bgCenter = screenToWorld({ x: rect.offsetX + rect.width / 2, y: rect.offsetY + rect.height / 2 }, containerSize)

  return (
    <mesh position={[bgCenter.x, bgCenter.y, 0]} material={material}>
      <planeGeometry args={[rect.width, rect.height]} />
    </mesh>
  )
}

interface LiveArCanvasProps {
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  getLandmarks: () => Vec3[] | null
  frameSize: { width: number; height: number }
  containerSize: { width: number; height: number }
  paramsRef: React.RefObject<ProcedureParams>
  dimpleAnchorsRef: React.RefObject<Partial<Record<RegionSide, FaceAnchoredPoint>>>
  onFaceDetectedChange?: (detected: boolean) => void
}

export function LiveArCanvas({
  source,
  getLandmarks,
  frameSize,
  containerSize,
  paramsRef,
  dimpleAnchorsRef,
  onFaceDetectedChange,
}: LiveArCanvasProps) {
  const rect = useMemo(() => computeContainRect(containerSize, frameSize), [containerSize, frameSize])

  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], near: 0.1, far: 100 }}
      gl={{ antialias: true }}
      className="absolute! inset-0"
    >
      <color attach="background" args={['#0a0b0d']} />
      <LiveArScene
        source={source}
        getLandmarks={getLandmarks}
        frameSize={frameSize}
        containerSize={containerSize}
        rect={rect}
        paramsRef={paramsRef}
        dimpleAnchorsRef={dimpleAnchorsRef}
        onFaceDetectedChange={onFaceDetectedChange}
      />
    </Canvas>
  )
}
