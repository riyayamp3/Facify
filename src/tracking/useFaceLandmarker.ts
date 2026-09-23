import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState } from 'react'
import { poseFromTransformationMatrix } from '../math/headPose'
import type { HeadPose, Vec3 } from '../types/face'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export interface TrackingSnapshot {
  landmarks: Vec3[] | null
  pose: HeadPose | null
  faceDetected: boolean
  timestampMs: number
}

const EMPTY_SNAPSHOT: TrackingSnapshot = {
  landmarks: null,
  pose: null,
  faceDetected: false,
  timestampMs: 0,
}

/**
 * Loads MediaPipe FaceLandmarker and runs detection on every animation
 * frame while `enabled`. Latest result is exposed via a ref (not React
 * state) so the 60fps tracking loop never triggers a React re-render —
 * consumers that need UI updates should poll the ref on their own cadence.
 */
export function useFaceLandmarker(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const latestRef = useRef<TrackingSnapshot>(EMPTY_SNAPSHOT)
  const rafRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE)
      const options = {
        runningMode: 'VIDEO' as const,
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
      }
      try {
        return await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          ...options,
        })
      } catch {
        // Some browsers/GPUs reject the WebGL-backed delegate — fall back
        // to CPU rather than leaving the user stuck on a load error.
        return FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          ...options,
        })
      }
    }

    load()
      .then((landmarker) => {
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setReady(true)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !enabled) return

    const tick = () => {
      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        const result = landmarker.detectForVideo(video, performance.now())
        const faceLandmarks = result.faceLandmarks[0]
        const matrix = result.facialTransformationMatrixes?.[0]

        latestRef.current = {
          landmarks: faceLandmarks ? faceLandmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })) : null,
          pose: matrix ? poseFromTransformationMatrix(matrix) : null,
          faceDetected: !!faceLandmarks,
          timestampMs: performance.now(),
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [ready, enabled, videoRef])

  return { ready, error, latestRef }
}
