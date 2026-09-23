export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface HeadPose {
  yaw: number
  pitch: number
  roll: number
}

export type ScanLeg = 'front' | 'left' | 'right'

export interface CapturedFrame {
  bucket: ScanLeg
  landmarks: Vec3[]
  pose: HeadPose
  score: number
  capturedAt: number
  frameSize: { width: number; height: number }
}

export interface FaceModel {
  scanFrames: CapturedFrame[]
  /** FRONT frame's landmarks in canonical (pose-normalized, metric) space. */
  baseLandmarks: Vec3[]
  /** Every captured frame's landmarks in canonical space, keyed by leg. */
  canonicalFrames: Partial<Record<ScanLeg, Vec3[]>>
  headPose: HeadPose
  scanMetadata: {
    anglesCaptured: ScanLeg[]
    capturedAt: number
  }
  scanQuality: {
    perBucketScore: Partial<Record<ScanLeg, number>>
  }
}

export type ScanPhase =
  | 'idle'
  | 'front'
  | 'left'
  | 'right'
  | 'building'
  | 'done'

export type ViewAnglePreset = 'L90' | 'L45' | 'L23' | 'FRONT' | 'R23' | 'R45' | 'R90'
