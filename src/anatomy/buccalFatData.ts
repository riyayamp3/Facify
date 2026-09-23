/**
 * Reference anatomical values for the buccal fat pad, used to calibrate
 * the simulation controls to clinically meaningful units (cc extracted)
 * instead of an abstract 0-100 scale. The pad sits deep in the cheek and
 * its size is largely independent of overall body weight.
 */
export const BUCCAL_FAT_PAD = {
  /** Average full pad volume per cheek: ~8-10cc, ~9.3g. */
  averageTotalVolumeCc: 9.3,
  /** Typical surgical removal range per cheek. */
  typicalRemovedMinCc: 2.6,
  typicalRemovedMaxCc: 4.5,
  /**
   * "50% rule": a conservative surgeon removes at most 40-50% of the pad
   * to avoid a hollow/prematurely aged look later in life. Used as the
   * simulation's hard ceiling, not just a suggestion.
   */
  conservativeMaxFraction: 0.5,
  averageFlapThicknessMm: 6,
} as const

export const MAX_EXTRACTABLE_CC =
  BUCCAL_FAT_PAD.averageTotalVolumeCc * BUCCAL_FAT_PAD.conservativeMaxFraction
