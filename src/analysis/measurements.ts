import {
  CHIN,
  EYE_OUTER_CORNER_LEFT,
  EYE_OUTER_CORNER_RIGHT,
  FACE_WIDTH_LEFT,
  FACE_WIDTH_RIGHT,
  FOREHEAD_TOP,
  GLABELLA,
  INNER_CANTHUS_LEFT,
  INNER_CANTHUS_RIGHT,
  LOWER_LIP_BOTTOM_CENTER,
  NASAL_ALA_LEFT,
  NASAL_ALA_RIGHT,
  NASION,
  NOSE_BASE_CENTER,
  NOSE_TIP,
  STOMION_LOWER,
  STOMION_UPPER,
  UPPER_LIP_TOP_CENTER,
} from '../anatomy/landmarkGroups'
import { angleAt, distance, midpoint, signedDistanceToLine } from '../math/vec3'
import type { Vec3 } from '../types/face'

export interface MeasurementSegment {
  from: Vec3
  to: Vec3
  label: string
}

export interface LineMeasurement {
  kind: 'line'
  segments: MeasurementSegment[]
  /** Short value for the analysis rail row, e.g. "4.8" or "33/34/33%". */
  value: string
  summary: string
}

export interface SurfaceMeasurement {
  kind: 'depth' | 'contour'
  value: string
  summary: string
}

export type Measurement = LineMeasurement | SurfaceMeasurement

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits)
}

/**
 * One compute function per ANALYSIS_ITEMS id. Every landmark used here was
 * checked against real canonical-space coordinates this session (see the
 * plan for the verification numbers) — none are guessed. No metric camera
 * calibration exists anywhere in this project, so anything without a
 * standard named ratio/angle is reported as a plain relative number, never
 * fabricated "mm".
 */
export const MEASUREMENTS: Record<string, (landmarks: Vec3[]) => Measurement> = {
  'facial-thirds': (lm) => {
    const top = lm[FOREHEAD_TOP]
    const glabella = lm[GLABELLA]
    const sub = lm[NOSE_BASE_CENTER]
    const chin = lm[CHIN]
    const upper = distance(top, glabella)
    const middle = distance(glabella, sub)
    const lower = distance(sub, chin)
    const total = upper + middle + lower
    return {
      kind: 'line',
      segments: [
        { from: top, to: glabella, label: `Upper ${fmt((upper / total) * 100, 0)}%` },
        { from: glabella, to: sub, label: `Middle ${fmt((middle / total) * 100, 0)}%` },
        { from: sub, to: chin, label: `Lower ${fmt((lower / total) * 100, 0)}%` },
      ],
      value: `${fmt((upper / total) * 100, 0)}/${fmt((middle / total) * 100, 0)}/${fmt((lower / total) * 100, 0)}%`,
      summary: 'Ideal ≈33% each (hairline is a proxy — not tracked)',
    }
  },

  'five-eye-ratio': (lm) => {
    const faceWidth = distance(lm[FACE_WIDTH_RIGHT], lm[FACE_WIDTH_LEFT])
    const eyeWidth = distance(lm[EYE_OUTER_CORNER_RIGHT], lm[INNER_CANTHUS_RIGHT])
    const ratio = faceWidth / eyeWidth
    return {
      kind: 'line',
      segments: [
        { from: lm[FACE_WIDTH_RIGHT], to: lm[FACE_WIDTH_LEFT], label: 'Face width' },
        { from: lm[EYE_OUTER_CORNER_RIGHT], to: lm[INNER_CANTHUS_RIGHT], label: 'Eye width' },
      ],
      value: fmt(ratio, 2),
      summary: `${fmt(ratio, 2)} eye-widths across (ideal ≈5)`,
    }
  },

  depth: () => ({
    kind: 'depth',
    value: 'view',
    summary: 'Relative surface depth — not calibrated to real mm',
  }),
  'contour-line': () => ({
    kind: 'contour',
    value: 'view',
    summary: 'Depth banded into contour-style steps',
  }),

  'side-face-angle': (lm) => {
    const glabella = lm[GLABELLA]
    const sub = lm[NOSE_BASE_CENTER]
    const chin = lm[CHIN]
    const angle = angleAt(glabella, sub, chin)
    return {
      kind: 'line',
      segments: [
        { from: glabella, to: sub, label: '' },
        { from: sub, to: chin, label: `${fmt(angle, 0)}°` },
      ],
      value: `${fmt(angle, 0)}°`,
      summary: 'Facial convexity angle at subnasale',
    }
  },

  'lifting-angle': (lm) => {
    const r = { inner: lm[INNER_CANTHUS_RIGHT], outer: lm[EYE_OUTER_CORNER_RIGHT] }
    const l = { inner: lm[INNER_CANTHUS_LEFT], outer: lm[EYE_OUTER_CORNER_LEFT] }
    const angleOf = (inner: Vec3, outer: Vec3) =>
      (Math.atan2(outer.y - inner.y, Math.abs(outer.x - inner.x)) * 180) / Math.PI
    const rightTilt = angleOf(r.inner, r.outer)
    const leftTilt = angleOf(l.inner, l.outer)
    return {
      kind: 'line',
      segments: [
        { from: r.inner, to: r.outer, label: `${fmt(rightTilt, 0)}°` },
        { from: l.inner, to: l.outer, label: `${fmt(leftTilt, 0)}°` },
      ],
      value: `${fmt((rightTilt + leftTilt) / 2, 0)}°`,
      summary: 'Canthal tilt — positive = "lifted" outer corner',
    }
  },

  'nasal-tip-projection': (lm) => {
    const alaMid = midpoint(lm[NASAL_ALA_RIGHT], lm[NASAL_ALA_LEFT])
    const tip = lm[NOSE_TIP]
    const nasion = lm[NASION]
    const projection = distance(alaMid, tip)
    const length = distance(nasion, tip)
    return {
      kind: 'line',
      segments: [
        { from: nasion, to: tip, label: 'Length' },
        { from: alaMid, to: tip, label: 'Projection' },
      ],
      value: fmt(projection / length, 2),
      summary: `Goode's ratio ${fmt(projection / length, 2)} (ideal ≈0.55–0.60)`,
    }
  },

  'e-line': (lm) => {
    const tip = lm[NOSE_TIP]
    const chin = lm[CHIN]
    const upperLip = lm[UPPER_LIP_TOP_CENTER]
    const lowerLip = lm[LOWER_LIP_BOTTOM_CENTER]
    const upperDist = signedDistanceToLine(upperLip, tip, chin)
    const lowerDist = signedDistanceToLine(lowerLip, tip, chin)
    const side = (d: number) => (d >= 0 ? 'behind' : 'in front of')
    return {
      kind: 'line',
      segments: [
        { from: tip, to: chin, label: 'E-line' },
        { from: upperLip, to: upperLip, label: `Upper lip ${side(upperDist)}` },
        { from: lowerLip, to: lowerLip, label: `Lower lip ${side(lowerDist)}` },
      ],
      value: `${fmt(Math.abs(upperDist) * 100, 1)}/${fmt(Math.abs(lowerDist) * 100, 1)}`,
      summary: 'Ricketts esthetic line (nose tip → chin)',
    }
  },

  'lip-chin-ratio': (lm) => {
    const sub = lm[NOSE_BASE_CENTER]
    const stomion = midpoint(lm[STOMION_UPPER], lm[STOMION_LOWER])
    const chin = lm[CHIN]
    const upper = distance(sub, stomion)
    const lower = distance(stomion, chin)
    return {
      kind: 'line',
      segments: [
        { from: sub, to: stomion, label: 'Upper lip' },
        { from: stomion, to: chin, label: 'Lower face' },
      ],
      value: `1:${fmt(lower / upper, 2)}`,
      summary: `Ratio 1:${fmt(lower / upper, 2)} (ideal ≈1:2)`,
    }
  },

  'lip-ratio': (lm) => {
    const top = lm[UPPER_LIP_TOP_CENTER]
    const stomionUpper = lm[STOMION_UPPER]
    const stomionLower = lm[STOMION_LOWER]
    const bottom = lm[LOWER_LIP_BOTTOM_CENTER]
    const upperHeight = distance(top, stomionUpper)
    const lowerHeight = distance(stomionLower, bottom)
    return {
      kind: 'line',
      segments: [
        { from: top, to: stomionUpper, label: 'Upper' },
        { from: stomionLower, to: bottom, label: 'Lower' },
      ],
      value: `1:${fmt(lowerHeight / upperHeight, 2)}`,
      summary: `Ratio 1:${fmt(lowerHeight / upperHeight, 2)} (ideal ≈1:1.6)`,
    }
  },
}
