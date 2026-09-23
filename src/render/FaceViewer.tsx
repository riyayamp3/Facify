import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { AnalysisRail } from '../analysis/AnalysisRail'
import { MEASUREMENTS } from '../analysis/measurements'
import type { FaceModel, ViewAnglePreset } from '../types/face'
import { CameraRig } from './CameraRig'
import { buildFaceGeometry } from './geometry'
import { MeasurementOverlay } from './MeasurementOverlay'
import { VIEW_ANGLE_YAW, ViewAngleBar } from './ViewAngleBar'

interface FaceViewerProps {
  faceModel: FaceModel
  onOpenSimulation: () => void
}

const FACE_MESH_VERTEX_COUNT = 468
const CONTOUR_BANDS = 8

/** Depth (continuous) or Contour (posterized into bands) vertex colors, by canonical Z. */
function buildDepthColors(landmarks: FaceModel['baseLandmarks'], banded: boolean): Float32Array {
  const zs = landmarks.slice(0, FACE_MESH_VERTEX_COUNT).map((p) => p.z)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const range = maxZ - minZ || 1
  const near = new THREE.Color('#4a90c9') // far
  const far = new THREE.Color('#e0563f') // near (toward viewer)

  const colors = new Float32Array(FACE_MESH_VERTEX_COUNT * 3)
  for (let i = 0; i < FACE_MESH_VERTEX_COUNT; i++) {
    let t = (zs[i] - minZ) / range
    if (banded) t = Math.min(CONTOUR_BANDS - 1, Math.floor(t * CONTOUR_BANDS)) / (CONTOUR_BANDS - 1)
    const c = near.clone().lerp(far, t)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  return colors
}

export function FaceViewer({ faceModel, onOpenSimulation }: FaceViewerProps) {
  const [preset, setPreset] = useState<ViewAnglePreset>('FRONT')
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null)

  const allValues = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [id, compute] of Object.entries(MEASUREMENTS)) {
      out[id] = compute(faceModel.baseLandmarks).value
    }
    return out
  }, [faceModel])

  const measurement = useMemo(() => {
    const compute = selectedAnalysis && MEASUREMENTS[selectedAnalysis]
    return compute ? compute(faceModel.baseLandmarks) : null
  }, [selectedAnalysis, faceModel])

  const isSurfaceMode = measurement?.kind === 'depth' || measurement?.kind === 'contour'

  const geometry = useMemo(() => {
    const geo = buildFaceGeometry(faceModel.baseLandmarks)
    if (measurement?.kind === 'depth' || measurement?.kind === 'contour') {
      const colors = buildDepthColors(faceModel.baseLandmarks, measurement.kind === 'contour')
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    return geo
  }, [faceModel, measurement])

  return (
    <div className="flex h-full flex-col bg-workstation-bg text-workstation-text">
      <header className="flex items-center justify-between border-b border-workstation-border px-6 py-4">
        <span className="text-sm font-medium tracking-[0.2em] text-workstation-muted">
          FACEIFY LABS
        </span>
        <nav className="flex items-center gap-6">
          <span className="border-b border-workstation-accent pb-1 text-sm text-workstation-text">
            Facial Analysis
          </span>
          <button
            onClick={onOpenSimulation}
            className="pb-1 text-sm text-workstation-muted hover:text-workstation-text"
          >
            Simulation
          </button>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <Canvas
            camera={{ position: [0, 0.05, 2.4], fov: 32 }}
            gl={{ antialias: true }}
            className="absolute! inset-0"
          >
            <color attach="background" args={['#0a0b0d']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 3, 4]} intensity={1.1} />
            <directionalLight position={[-3, 1, -2]} intensity={0.3} />
            <mesh geometry={geometry}>
              {/* key forces a fresh material instance when vertexColors toggles —
                  Three.js doesn't recompile an existing material's shader (which
                  needs a different USE_COLOR define) just because the boolean
                  prop changed, so re-mounting is the reliable fix. */}
              <meshStandardMaterial
                key={isSurfaceMode ? 'surface' : 'plain'}
                color={isSurfaceMode ? '#ffffff' : '#c9b8a6'}
                vertexColors={isSurfaceMode}
                roughness={0.65}
                metalness={0.05}
                side={THREE.DoubleSide}
              />
            </mesh>

            {measurement?.kind === 'line' && <MeasurementOverlay measurement={measurement} />}

            <CameraRig targetYawDeg={VIEW_ANGLE_YAW[preset]} interactive />
          </Canvas>

          {measurement && (
            <div className="absolute bottom-4 left-4 max-w-xs rounded-sm border border-workstation-border bg-workstation-panel/90 px-3 py-2 text-xs text-workstation-muted">
              {measurement.summary}
            </div>
          )}

          <span className="absolute bottom-4 right-4 text-[11px] text-workstation-muted">
            Scroll to zoom · drag to move
          </span>
        </div>

        <AnalysisRail selected={selectedAnalysis} onSelect={setSelectedAnalysis} values={allValues} />
      </div>

      <div className="flex justify-center border-t border-workstation-border py-4">
        <ViewAngleBar value={preset} onChange={setPreset} />
      </div>
    </div>
  )
}
