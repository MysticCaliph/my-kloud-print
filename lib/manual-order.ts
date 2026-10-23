import { calculatePrintCostPoisha, type PaperSize } from '@/lib/print'

export type ManualPaperSize = 'A4' | 'LEGAL'
export type ManualPrintSide = 'SINGLE' | 'DUPLEX'

export function calculateManualOrderCostPoisha(
  paperSize: ManualPaperSize,
  side: ManualPrintSide,
  totalPages: number,
  copies: number,
) {
  const normalizedPaper: PaperSize = paperSize === 'LEGAL' ? 'Legal' : 'A4'
  return calculatePrintCostPoisha(totalPages, normalizedPaper, side, copies)
}
