import { PRINT_RATES_POISHA, type PrintColor } from '@/lib/print'

export type ManualPaperSize = 'A4' | 'LEGAL'

export const MANUAL_PRINT_RATES_POISHA: Record<
  ManualPaperSize,
  Record<PrintColor, number>
> = {
  A4: PRINT_RATES_POISHA.A4,
  LEGAL: PRINT_RATES_POISHA.Legal,
}

export function calculateManualOrderCostPoisha(
  paperSize: ManualPaperSize,
  color: PrintColor,
  totalPages: number,
  copies: number,
) {
  return MANUAL_PRINT_RATES_POISHA[paperSize][color] * totalPages * copies
}
