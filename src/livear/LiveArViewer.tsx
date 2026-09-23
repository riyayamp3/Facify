import { useEffect, useRef, useState } from 'react'
import { EYE_OUTER_CORNER_LEFT, EYE_OUTER_CORNER_RIGHT } from '../anatomy/landmarkGroups'
import { useCamera } from '../camera/useCamera'
import { imageLandmarksToMetric } from '../math/landmarkSpace'
import { distance } from '../math/vec3'
import { ProcedureSidebar } from '../simulation/ProcedureSidebar'
import { useProcedureControls } from '../simulation/useProcedureControls'
import { useFaceLandmarker } from '../tracking/useFaceLandmarker'
import type { RegionSide } from '../anatomy/regions'
import { anchorPointToNearestLandmark, type FaceAnchoredPoint } from './faceAnchoredPoint'
import { LiveArCanvas } from './LiveArCanvas'
import { computeContainRect, viewportToVideoNorm } from './viewportMapping'

const FACE_MESH_VERTEX_COUNT = 468

interface LiveArViewerProps {
  onBack: () => void
}

export function LiveArViewer({ onBack }: LiveArViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { videoRef, status: cameraStatus, error: cameraError, retry } = useCamera()
  const { ready: trackerReady, error: trackerError, latestRef } = useFaceLandmarker(
    videoRef,
    cameraStatus === 'ready',
  )

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })
  const [faceDetected, setFaceDetected] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onLoaded = () => setFrameSize({ width: video.videoWidth, height: video.videoHeight })
    video.addEventListener('loadedmetadata', onLoaded)
    if (video.videoWidth) onLoaded()
    return () => video.removeEventListener('loadedmetadata', onLoaded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraStatus])

  // No static scanned mesh exists yet — pass no vertices for the Live AR
  // controls (dimple's Khoo Boo-Chai default needs a click here instead;
  // see the click handler below).
  const controls = useProcedureControls([])
  const { isDimple, params, dimplePositions, setDimplePositions } = controls
  const paramsRef = useRef(params)
  paramsRef.current = params

  // dimplePositions itself is frame-relative and goes stale the instant the
  // face moves (see faceAnchoredPoint.ts) — it's kept only so the sidebar's
  // "placed"/"Clear" UI has something truthy to check. The anchors here are
  // what LiveArCanvas actually renders from each frame, re-deriving a live
  // position as nearestLandmark + offset.
  const dimpleAnchorsRef = useRef<Partial<Record<RegionSide, FaceAnchoredPoint>>>({})
  useEffect(() => {
    for (const side of ['right', 'left'] as const) {
      if (!dimplePositions[side]) delete dimpleAnchorsRef.current[side]
    }
  }, [dimplePositions])

  const ready = cameraStatus === 'ready' && trackerReady && frameSize.width > 0

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDimple || !ready) return
    const el = containerRef.current
    if (!el) return
    const rawLandmarks = latestRef.current.landmarks
    if (!rawLandmarks) return
    const bounds = el.getBoundingClientRect()
    const rect = computeContainRect(containerSize, frameSize)
    // The video+canvas are mirrored via CSS (scaleX(-1) about the center),
    // so a click's on-screen X must be reflected back before it lines up
    // with the unmirrored coordinates the rendering math uses.
    const mirroredX = bounds.width - (e.clientX - bounds.left)
    const norm = viewportToVideoNorm({ x: mirroredX, y: e.clientY - bounds.top }, rect)
    if (norm.x < 0 || norm.x > 1 || norm.y < 0 || norm.y > 1) return

    const [metricPoint] = imageLandmarksToMetric([{ x: norm.x, y: norm.y, z: 0 }], frameSize)
    const metricLandmarks = imageLandmarksToMetric(rawLandmarks.slice(0, FACE_MESH_VERTEX_COUNT), frameSize)
    const side: RegionSide = metricPoint.x < 0 ? 'right' : 'left'

    const clickTimeScale = distance(metricLandmarks[EYE_OUTER_CORNER_RIGHT], metricLandmarks[EYE_OUTER_CORNER_LEFT])
    dimpleAnchorsRef.current[side] = anchorPointToNearestLandmark(metricPoint, metricLandmarks, clickTimeScale)
    setDimplePositions((prev) => ({ ...prev, [side]: metricPoint }))
  }

  return (
    <div className="flex h-full flex-col bg-workstation-bg text-workstation-text">
      <header className="flex items-center justify-between border-b border-workstation-border px-6 py-4">
        <span className="text-sm font-medium tracking-[0.2em] text-workstation-muted">FACEIFY LABS</span>
        <nav className="flex items-center gap-6">
          <button onClick={onBack} className="pb-1 text-sm text-workstation-muted hover:text-workstation-text">
            Mode Select
          </button>
          <span className="border-b border-workstation-accent pb-1 text-sm text-workstation-text">Live AR</span>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="relative flex-1 overflow-hidden" onClick={handleClick}>
          {/* Mirrored so the live view acts like a mirror — natural for a
              selfie-style experience, matching the scan flow's preview. */}
          <div className="absolute inset-0 -scale-x-100">
            <video ref={videoRef} autoPlay playsInline muted className="absolute h-px w-px opacity-0" />
            {ready && (
              <LiveArCanvas
                source={videoRef.current!}
                getLandmarks={() => latestRef.current.landmarks}
                frameSize={frameSize}
                containerSize={containerSize}
                paramsRef={paramsRef}
                dimpleAnchorsRef={dimpleAnchorsRef}
                onFaceDetectedChange={setFaceDetected}
              />
            )}
          </div>

          {cameraStatus === 'requesting' && (
            <p className="absolute inset-0 flex items-center justify-center text-workstation-muted">
              Requesting camera access…
            </p>
          )}
          {cameraStatus === 'denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <p className="text-red-400">Camera access was denied.</p>
              <button
                onClick={retry}
                className="rounded-full border border-workstation-border px-4 py-1 text-xs text-workstation-muted hover:text-workstation-text"
              >
                Try again
              </button>
            </div>
          )}
          {cameraStatus === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <p className="text-red-400">Camera error: {cameraError}</p>
              <button
                onClick={retry}
                className="rounded-full border border-workstation-border px-4 py-1 text-xs text-workstation-muted hover:text-workstation-text"
              >
                Try again
              </button>
            </div>
          )}
          {trackerError && (
            <p className="absolute inset-0 flex items-center justify-center text-red-400">
              Tracking error: {trackerError}
            </p>
          )}
          {cameraStatus === 'ready' && !ready && !trackerError && (
            <p className="absolute inset-0 flex items-center justify-center text-workstation-muted">
              Loading face tracking model…
            </p>
          )}
          {ready && !faceDetected && (
            <p className="absolute inset-x-0 bottom-4 text-center text-xs text-workstation-muted">
              Can't see a face — center yourself in frame with good lighting.
            </p>
          )}
        </div>

        <ProcedureSidebar controls={controls} showDragHints={false} />
      </div>
    </div>
  )
}
