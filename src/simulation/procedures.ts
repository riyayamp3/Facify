export interface Procedure {
  id: string
  label: string
  status: 'available' | 'coming-soon'
}

export const PROCEDURES: Procedure[] = [
  { id: 'buccal-fat-removal', label: 'Buccal Fat Removal', status: 'available' },
  { id: 'lip-lift', label: 'Lip Lift', status: 'available' },
  { id: 'dimpleplasty', label: 'Dimpleplasty', status: 'available' },
  { id: 'brow-lift', label: 'Endoscopic Brow Lift', status: 'available' },
  { id: 'hairline-lowering', label: 'Hairline Lowering', status: 'available' },
]
