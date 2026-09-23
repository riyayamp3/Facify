import { useEffect, useRef, useState } from 'react'
import { useCamera } from '../camera/useCamera'
import { useFaceLandmarker } from '../tracking/useFaceLandmarker'
import { buildFaceModel } from '../model/faceModel'
import type { CapturedFrame, FaceModel, ScanLeg } from '../types/face'
import { SCAN_LEG_ORDER, zoneForYaw } from './angleBuckets'
import { FaceGuideOverlay, type GuideState } from './FaceGuideOverlay'
import { evaluateFraming, type FramingIssue } from './framing'
import { MIN_BRIGHTNESS, MIN_SHARPNESS_VARIANCE, StabilityTracker, computeFrameQuality } from './scanQuality'

const POLL_INTERVAL_MS = 90
const FACE_MISSING_HINT_DELAY_MS = 1200

const PHASE_TITLE: Record<ScanLeg, string> = {
  front: 'Step 1 of 3 — Front',
  left: 'Step 2 of 3 — Turn left',
  right: 'Step 3 of 3 — Turn right',
}

const PHASE_DESCRIPTION: Record<ScanLeg, string> = {
  front: 'Look straight at the camera, centered in the frame, and hold still.',
  left: 'Slowly turn your head to your left by about 30–45°, then hold still.',
  right: 'Slowly turn your head to your right by about 30–45°, then hold still.',
}

const FRAMING_HINT: Record<Exclude<FramingIssue, null>, string> = {
  'move-closer': 'Move a little closer to the camera.',
  'move-back': "You're too close — move back a little.",
  center: 'Center your face in the outline.',
}

interface ScanControllerProps {
  onComplete: (model: FaceModel) => void
}

export function ScanController({ onComplete }: ScanControllerProps) {
  const { videoRef, status: cameraStatus, error: cameraError, retry: retryCamera } = useCamera()
  const { ready: trackerReady, error: trackerError, latestRef } = useFaceLandmarker(
    videoRef,
    cameraStatus === 'ready',
  )

  const [capturedZones, setCapturedZones] = useState<ScanLeg[]>([])
  const [flash, setFlash] = useState(false)
  const [building, setBuilding] = useState(false)
  const [hint, setHint] = useState('')
  const [guideState, setGuideState] = useState<GuideState>('none')
  const [yaw, setYaw] = useState(0)

  const framesRef = useRef<CapturedFrame[]>([])
  const stabilityRef = useRef(new StabilityTracker())
  const capturedZonesRef = useRef(capturedZones)
  capturedZonesRef.current = capturedZones
  const faceMissingSinceRef = useRef<number | null>(null)

  const targetPhase: ScanLeg | 'done' =
    capturedZones.length < SCAN_LEG_ORDER.length ? SCAN_LEG_ORDER[capturedZones.length] : 'done'
  const targetPhaseRef = useRef<ScanLeg | 'done'>(targetPhase)
  targetPhaseRef.current = targetPhase

  const scanning = cameraStatus === 'ready' && trackerReady && !building

  const captureNow = (bucket: ScanLeg) => {
    const snapshot = latestRef.current
    const video = videoRef.current
    if (!snapshot.landmarks || !snapshot.pose || !video) return

    const frame: CapturedFrame = {
      bucket,
      landmarks: snapshot.landmarks,
      pose: snapshot.pose,
      score: 1,
      capturedAt: snapshot.timestampMs,
      frameSize: { width: video.videoWidth, height: video.videoHeight },
    }
    framesRef.current = [...framesRef.current, frame]
    setCapturedZones((prev) => (prev.includes(bucket) ? prev : [...prev, bucket]))
    setFlash(true)
    setTimeout(() => setFlash(false), 400)
  }

  useEffect(() => {
    if (!scanning) return

    const interval = setInterval(() => {
      const snapshot = latestRef.current
      const video = videoRef.current
      const target = targetPhaseRef.current
      if (!video || target === 'done') return

      if (!snapshot.faceDetected || !snapshot.pose || !snapshot.landmarks) {
        if (faceMissingSinceRef.current === null) faceMissingSinceRef.current = snapshot.timestampMs
        const missingFor = snapshot.timestampMs - faceMissingSinceRef.current
        setGuideState('none')
        setHint(
          missingFor > FACE_MISSING_HINT_DELAY_MS
            ? "Can't see your face — check lighting and make sure you're facing the camera."
            : '',
        )
        return
      }
      faceMissingSinceRef.current = null

      setYaw(snapshot.pose.yaw)

      const framing = evaluateFraming(snapshot.landmarks, video.videoWidth, video.videoHeight)
      if (!framing.ok) {
        setGuideState('adjust')
        setHint(framing.issue ? FRAMING_HINT[framing.issue] : '')
        return
      }

      const quality = computeFrameQuality(video, snapshot.landmarks)
      if (quality && quality.meanBrightness < MIN_BRIGHTNESS) {
        setGuideState('adjust')
        setHint('Try moving to a brighter area.')
        return
      }

      stabilityRef.current.push(snapshot.pose, snapshot.timestampMs)
      const zone = zoneForYaw(snapshot.pose.yaw)
      const stable = stabilityRef.current.isStable()
      const sharpEnough = !quality || quality.variance >= MIN_SHARPNESS_VARIANCE
      const zoneMatches = zone === target

      if (!zoneMatches) {
        setGuideState('adjust')
        setHint('Turn to the position described above.')
      } else if (!stable) {
        setGuideState('adjust')
        setHint('Hold still…')
      } else if (!sharpEnough) {
        setGuideState('adjust')
        setHint('Hold steady — image looks soft.')
      } else {
        setGuideState('good')
        setHint('Capturing…')
        if (!capturedZonesRef.current.includes(target)) captureNow(target)
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, latestRef, videoRef])

  useEffect(() => {
    if (targetPhase !== 'done' || building) return
    setBuilding(true)
    const model = buildFaceModel(framesRef.current)
    onComplete(model)
  }, [targetPhase, building, onComplete])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-workstation-bg px-6 text-workstation-text">
      <h1 className="text-lg font-light tracking-wide text-workstation-muted">
        Let's build your facial model.
      </h1>

      <div className="relative w-full max-w-md overflow-hidden rounded-sm border border-workstation-border bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-video w-full -scale-x-100 object-cover"
        />
        {scanning && targetPhase !== 'done' && <FaceGuideOverlay state={guideState} />}
        {flash && <div className="pointer-events-none absolute inset-0 bg-workstation-accent/20" />}
      </div>

      {cameraStatus === 'requesting' && <p className="text-workstation-muted">Requesting camera access…</p>}
      {cameraStatus === 'denied' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-red-400">Camera access was denied.</p>
          <button
            onClick={retryCamera}
            className="rounded-full border border-workstation-border px-4 py-1 text-xs text-workstation-muted hover:text-workstation-text"
          >
            Try again
          </button>
        </div>
      )}
      {cameraStatus === 'error' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-red-400">Camera error: {cameraError}</p>
          <button
            onClick={retryCamera}
            className="rounded-full border border-workstation-border px-4 py-1 text-xs text-workstation-muted hover:text-workstation-text"
          >
            Try again
          </button>
        </div>
      )}
      {trackerError && <p className="text-red-400">Tracking error: {trackerError}</p>}
      {cameraStatus === 'ready' && !trackerReady && (
        <p className="text-workstation-muted">Loading face tracking model…</p>
      )}

      {scanning && targetPhase !== 'done' && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium tracking-wide text-workstation-accent">
            {PHASE_TITLE[targetPhase]}
          </p>
          <p className="max-w-sm text-base text-workstation-text">{PHASE_DESCRIPTION[targetPhase]}</p>
          <p className="min-h-5 text-xs text-workstation-muted">{hint}</p>
          <p className="text-xs text-workstation-muted">yaw: {yaw.toFixed(1)}°</p>

          <div className="mt-1 flex gap-2">
            {SCAN_LEG_ORDER.map((leg) => (
              <span
                key={leg}
                className={
                  'h-2 w-2 rounded-full ' +
                  (capturedZones.includes(leg) ? 'bg-workstation-accent' : 'bg-workstation-border')
                }
              />
            ))}
          </div>

          <button
            onClick={() => captureNow(targetPhase)}
            className="mt-2 rounded-full border border-workstation-accent px-5 py-1.5 text-xs tracking-wide text-workstation-accent transition-colors hover:bg-workstation-accent hover:text-black"
          >
            Capture now
          </button>
        </div>
      )}

      {building && <p className="text-workstation-muted">Building your facial model…</p>}
    </div>
  )
}
