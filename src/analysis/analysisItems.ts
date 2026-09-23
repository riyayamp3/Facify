export interface AnalysisItem {
  id: string
  label: string
}

export const ANALYSIS_ITEMS: AnalysisItem[] = [
  { id: 'facial-thirds', label: 'Facial Thirds' },
  { id: 'five-eye-ratio', label: 'Five-Eye Ratio' },
  { id: 'depth', label: 'Depth' },
  { id: 'contour-line', label: 'Contour Line' },
  { id: 'side-face-angle', label: 'Side Face Angle' },
  { id: 'lifting-angle', label: 'Lifting Angle' },
  { id: 'nasal-tip-projection', label: 'Nasal Tip Projection' },
  { id: 'e-line', label: 'E-Line' },
  { id: 'lip-chin-ratio', label: 'Lip-Chin Ratio' },
  { id: 'lip-ratio', label: 'Lip Ratio' },
]
