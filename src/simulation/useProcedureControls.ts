import { useMemo, useState } from 'react'
import { getKbcPoint, type RegionSide } from '../anatomy/regions'
import type { Vec3 } from '../types/face'
import {
  BROW_DEFAULT_RADIUS,
  DEFAULT_RADIUS,
  DIMPLE_DEFAULT_RADIUS,
  HAIRLINE_DEFAULT_RADIUS,
  LIP_DEFAULT_RADIUS,
  UI_MAX_CC,
  clamp,
  deformFace,
  getActiveRegions,
  type ProcedureParams,
} from './deformFace'
import { BUCCAL_REGIONS } from '../anatomy/regions'

/**
 * All procedure slider/state — shared by the 3D Playground (static scanned
 * mesh) and Live AR (live tracked face), so both offer identical controls
 * and neither can drift out of sync with the other.
 */
export function useProcedureControls(baseVertices: Vec3[]) {
  const [selectedProcedure, setSelectedProcedure] = useState('buccal-fat-removal')
  const [extractedCc, setExtractedCc] = useState<Record<string, number>>({})
  const [radius, setRadius] = useState(DEFAULT_RADIUS)
  const [liftPercent, setLiftPercent] = useState<Record<string, number>>({})
  const [lipRadius, setLipRadius] = useState(LIP_DEFAULT_RADIUS)
  // Defaults to the Khoo Boo-Chai point (traditional dimple placement
  // reference: outer-eye-corner vertical x mouth-corner horizontal) —
  // clicking on the face overrides it per side, matching how real
  // consultations adjust from that reference for face shape/preference.
  const [dimplePositions, setDimplePositions] = useState<Partial<Record<RegionSide, Vec3>>>(() =>
    baseVertices.length > 0
      ? { right: getKbcPoint(baseVertices, 'right'), left: getKbcPoint(baseVertices, 'left') }
      : {},
  )
  const [dimpleDepth, setDimpleDepth] = useState<Record<string, number>>({})
  const [dimpleRadius, setDimpleRadius] = useState(DIMPLE_DEFAULT_RADIUS)
  const [browRadius, setBrowRadius] = useState(BROW_DEFAULT_RADIUS)
  const [hairlineRadius, setHairlineRadius] = useState(HAIRLINE_DEFAULT_RADIUS)

  const isBuccal = selectedProcedure === 'buccal-fat-removal'
  const isLipLift = selectedProcedure === 'lip-lift'
  const isDimple = selectedProcedure === 'dimpleplasty'
  const isBrow = selectedProcedure === 'brow-lift'
  const isHairline = selectedProcedure === 'hairline-lowering'
  const activeRegions = getActiveRegions(selectedProcedure)

  const regionAnchorGroups = useMemo(
    () =>
      baseVertices.length === 0
        ? []
        : activeRegions.map((region) => ({ region, anchors: region.getAnchors(baseVertices) })),
    [baseVertices, activeRegions],
  )

  // The 50% rule caps TOTAL volume removed per side (main body + buccal
  // extension combined), not each control independently — otherwise two
  // sliders could each hit the cap and remove the whole pad between them.
  const sideTotal = (side: RegionSide, cc: Record<string, number>) =>
    BUCCAL_REGIONS.filter((r) => r.side === side).reduce((sum, r) => sum + (cc[r.id] ?? 0), 0)

  const setRegionCc = (regionId: string, desired: number) => {
    setExtractedCc((prev) => {
      const region = BUCCAL_REGIONS.find((r) => r.id === regionId)!
      const others = sideTotal(region.side!, prev) - (prev[regionId] ?? 0)
      const maxAllowed = Math.max(0, UI_MAX_CC - others)
      return { ...prev, [regionId]: clamp(desired, 0, maxAllowed) }
    })
  }

  const setRegionLift = (regionId: string, desired: number) => {
    setLiftPercent((prev) => ({ ...prev, [regionId]: clamp(desired, 0, 100) }))
  }

  const params: ProcedureParams = {
    selectedProcedure,
    extractedCc,
    radius,
    liftPercent,
    lipRadius,
    dimplePositions,
    dimpleDepth,
    dimpleRadius,
    browRadius,
    hairlineRadius,
  }

  // Convenience for static callers (3D Playground) — Live AR instead calls
  // deformFace(...) itself every frame with live vertices, bypassing this.
  const deformedVertices = useMemo(() => deformFace(baseVertices, params), [baseVertices, params])

  return {
    selectedProcedure,
    setSelectedProcedure,
    extractedCc,
    radius,
    setRadius,
    liftPercent,
    lipRadius,
    setLipRadius,
    dimplePositions,
    setDimplePositions,
    dimpleDepth,
    setDimpleDepth,
    dimpleRadius,
    setDimpleRadius,
    browRadius,
    setBrowRadius,
    hairlineRadius,
    setHairlineRadius,
    isBuccal,
    isLipLift,
    isDimple,
    isBrow,
    isHairline,
    activeRegions,
    regionAnchorGroups,
    sideTotal,
    setRegionCc,
    setRegionLift,
    params,
    deformedVertices,
  }
}

export type ProcedureControls = ReturnType<typeof useProcedureControls>
