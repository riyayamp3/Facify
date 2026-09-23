import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { RegionSide } from '../anatomy/regions'
import { displacementMagnitudes } from '../deformation/radialField'
import { CameraRig } from '../render/CameraRig'
import { buildFaceGeometry } from '../render/geometry'
import { VIEW_ANGLE_YAW, ViewAngleBar } from '../render/ViewAngleBar'
import type { FaceModel, ViewAnglePreset } from '../types/face'
import { DRAG_SENSITIVITY_CC, LIP_DRAG_SENSITIVITY } from './deformFace'
import { ProcedureSidebar, type ViewMode } from './ProcedureSidebar'
import { useProcedureControls } from './useProcedureControls'

interface SimulationViewerProps {
  faceModel: FaceModel
  onBack: () => void
}

export function SimulationViewer({ faceModel, onBack }: SimulationViewerProps) {
  const baseVertices = faceModel.baseLandmarks
  const controls = useProcedureControls(baseVertices)
  const {
    isBuccal,
    isDimple,
    extractedCc,
    liftPercent,
    setRegionCc,
    setRegionLift,
    setDimplePositions,
    regionAnchorGroups,
    deformedVertices,
  } = controls

  const [viewMode, setViewMode] = useState<ViewMode>('simulated')
  const [preset, setPreset] = useState<ViewAnglePreset>('FRONT')
  const dragState = useRef<{ startY: number; toValue: (deltaY: number) => number; commit: (v: number) => void } | null>(null)

  const displayVertices = viewMode === 'original' ? baseVertices : deformedVertices

  const geometry = useMemo(() => {
    const geo = buildFaceGeometry(displayVertices)
    if (viewMode === 'difference') {
      const mags = displacementMagnitudes(baseVertices, deformedVertices)
      const maxMag = Math.max(...mags, 1e-6)
      const colors = new Float32Array(mags.length * 3)
      const base = new THREE.Color('#c9b8a6')
      const hot = new THREE.Color('#ff6b35')
      for (let i = 0; i < mags.length; i++) {
        const c = base.clone().lerp(hot, mags[i] / maxMag)
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    return geo
  }, [displayVertices, viewMode, baseVertices, deformedVertices])

  const handleMarkerDown = (regionId: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (isBuccal) {
      const startCc = extractedCc[regionId] ?? 0
      dragState.current = {
        startY: e.clientY,
        toValue: (deltaY) => startCc + deltaY * DRAG_SENSITIVITY_CC,
        commit: (v) => setRegionCc(regionId, v),
      }
    } else {
      const startPct = liftPercent[regionId] ?? 0
      dragState.current = {
        startY: e.clientY,
        toValue: (deltaY) => startPct + deltaY * LIP_DRAG_SENSITIVITY,
        commit: (v) => setRegionLift(regionId, v),
      }
    }
  }

  const handleMarkerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState.current) return
    e.stopPropagation()
    const { startY, toValue, commit } = dragState.current
    commit(toValue(startY - e.clientY))
  }

  const handleMarkerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    dragState.current = null
  }

  // Dimpleplasty has no fixed landmark — the surgeon marks the spot, so
  // the user clicks anywhere on the cheek to place (or move) it. Side is
  // whichever half of the face the click landed on (canonical space: x<0
  // is the subject's right, matching MediaPipe's own left/right convention
  // already used for mouth corners elsewhere).
  const handleFaceClick = (e: ThreeEvent<PointerEvent>) => {
    if (!isDimple) return
    e.stopPropagation()
    const side: RegionSide = e.point.x < 0 ? 'right' : 'left'
    setDimplePositions((prev) => ({ ...prev, [side]: { x: e.point.x, y: e.point.y, z: e.point.z } }))
  }

  return (
    <div className="flex h-full flex-col bg-workstation-bg text-workstation-text">
      <header className="flex items-center justify-between border-b border-workstation-border px-6 py-4">
        <span className="text-sm font-medium tracking-[0.2em] text-workstation-muted">
          FACEIFY LABS
        </span>
        <nav className="flex items-center gap-6">
          <button onClick={onBack} className="pb-1 text-sm text-workstation-muted hover:text-workstation-text">
            Facial Analysis
          </button>
          <span className="border-b border-workstation-accent pb-1 text-sm text-workstation-text">
            Simulation
          </span>
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
            <mesh geometry={geometry} onPointerDown={handleFaceClick}>
              {/* key forces a fresh material instance when vertexColors toggles —
                  Three.js doesn't recompile an existing material's shader (which
                  needs a different USE_COLOR define) just because the boolean
                  prop changed, so re-mounting is the reliable fix. */}
              <meshStandardMaterial
                key={viewMode}
                color={viewMode === 'difference' ? '#ffffff' : '#c9b8a6'}
                vertexColors={viewMode === 'difference'}
                roughness={0.65}
                metalness={0.05}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* One draggable handle per region, not one per anchor — all
                anchors in a region share the same slider value, so e.g.
                lip-direct's 10 border points would otherwise render as
                10 identical overlapping handles. Corner lift is the one
                region that's genuinely two separate points, so it keeps
                a handle at each. */}
            {regionAnchorGroups.flatMap(({ region, anchors }) => {
              const handleAnchors = region.id === 'lip-corner' ? anchors : [anchors[Math.floor(anchors.length / 2)]]
              return handleAnchors.map((anchor, i) => (
                <mesh
                  key={`${region.id}-${i}`}
                  position={[anchor.x, anchor.y, anchor.z]}
                  onPointerDown={handleMarkerDown(region.id)}
                  onPointerMove={handleMarkerMove}
                  onPointerUp={handleMarkerUp}
                >
                  {/* Invisible hit target — opacity doesn't affect Three.js
                      raycasting, so dragging directly on the face still
                      works without a visible marker cluttering the view. */}
                  <sphereGeometry args={[0.02, 8, 8]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
              ))
            })}

            <CameraRig targetYawDeg={VIEW_ANGLE_YAW[preset]} />
          </Canvas>
        </div>

        <ProcedureSidebar controls={controls} viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      <div className="flex justify-center border-t border-workstation-border py-4">
        <ViewAngleBar value={preset} onChange={setPreset} />
      </div>
    </div>
  )
}
