import {
  calculateDeliveryFeePoisha,
  calculatePrintCostPoisha,
  type PaperSize,
} from '@/lib/print'

export type ManualPaperSize = 'A4' | 'LEGAL'
export type ManualPrintSide = 'SINGLE' | 'DUPLEX'

export function calculateManualOrderCostPoisha(
  paperSize: ManualPaperSize,
  side: ManualPrintSide,
  totalPages: number,
  copies: number,
  deliveryOption?: string | null,
) {
  const normalizedPaper: PaperSize = paperSize === 'LEGAL' ? 'Legal' : 'A4'
  const printPoisha = calculatePrintCostPoisha(totalPages, normalizedPaper, side, copies)
  const deliveryPoisha = calculateDeliveryFeePoisha(totalPages, copies, deliveryOption)
  return printPoisha + deliveryPoisha
}
