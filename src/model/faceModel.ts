import { toCanonicalSpace } from '../math/canonicalSpace'
import type { CapturedFrame, FaceModel, ScanLeg } from '../types/face'

export function buildFaceModel(frames: CapturedFrame[]): FaceModel {
  const frontFrame = frames.find((f) => f.bucket === 'front') ?? frames[0]

  const perBucketScore: Partial<Record<ScanLeg, number>> = {}
  const canonicalFrames: Partial<Record<ScanLeg, ReturnType<typeof toCanonicalSpace>>> = {}
  for (const frame of frames) {
    perBucketScore[frame.bucket] = frame.score
    canonicalFrames[frame.bucket] = toCanonicalSpace(frame)
  }

  return {
    scanFrames: frames,
    baseLandmarks: canonicalFrames.front ?? toCanonicalSpace(frontFrame),
    canonicalFrames,
    headPose: frontFrame.pose,
    scanMetadata: {
      anglesCaptured: frames.map((f) => f.bucket),
      capturedAt: Date.now(),
    },
    scanQuality: { perBucketScore },
  }
}
