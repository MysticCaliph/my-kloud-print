export type PrintColor = 'bw'
export type PaperSize = 'A4' | 'Legal'
export type PrintSide = 'single' | 'duplex' | 'SINGLE' | 'DUPLEX'
export type UploadMethod = 'DIRECT' | 'WHATSAPP' | 'TELEGRAM'

export interface PrintOptions {
  color: 'bw'
  paperSize: PaperSize
  side: 'single' | 'duplex'
  copies: number
}

export const CUSTOM_DELIVERY_OPTION = 'Any Other Place (Charge Applicable)'

export const DELIVERY_FEE_POISHA = {
  upTo50Pages: 2000, // 20.00 TK
  over50Pages: 3000, // 30.00 TK
} as const

// 1 TK = 100 Poisha
// A4 Single: 1.75 TK (175 poisha/page)
// A4 Duplex: 3.00 TK/sheet (300 poisha per 2 pages; odd page: 175 poisha)
// Legal Single: 2.25 TK (225 poisha/page)
// Legal Duplex: 4.00 TK/sheet (400 poisha per 2 pages; odd page: 225 poisha)
export const PRINT_RATES_POISHA = {
  A4: {
    singlePagePoisha: 175,
    duplexSheetPoisha: 300,
  },
  Legal: {
    singlePagePoisha: 225,
    duplexSheetPoisha: 400,
  },
} as const

export const MAX_COPIES = 99

export function formatBDT(amount: number) {
  return `৳${amount.toFixed(2)}`
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function isCustomDeliveryOption(deliveryOption?: string | null): boolean {
  if (!deliveryOption) return false
  const normalized = deliveryOption.trim().toLowerCase()
  return (
    normalized === CUSTOM_DELIVERY_OPTION.toLowerCase() ||
    normalized.startsWith('any other place')
  )
}

/**
 * Calculates tiered delivery fee in poisha when "Any Other Place (Charge Applicable)" is selected:
 * - Total printed pages (selectedPages * copies) <= 50: 20 TK (2000 poisha)
 * - Total printed pages (selectedPages * copies) > 50: 30 TK (3000 poisha)
 */
export function calculateDeliveryFeePoisha(
  selectedPages: number,
  copies: number,
  deliveryOption?: string | null,
): number {
  if (!isCustomDeliveryOption(deliveryOption)) return 0
  if (selectedPages <= 0 || copies <= 0) return 0
  const totalPrintedPages = selectedPages * copies
  return totalPrintedPages <= 50
    ? DELIVERY_FEE_POISHA.upTo50Pages
    : DELIVERY_FEE_POISHA.over50Pages
}

/** Parses "1-3, 5, 8-10" into a sorted, de-duplicated list of page numbers. */
export function parsePageRange(input: string, totalPages: number) {
  const pages = new Set<number>()
  const trimmed = input.trim()
  if (!trimmed) return { pages: [] as number[], error: 'Enter at least one page' }

  for (const rawPart of trimmed.split(',')) {
    const part = rawPart.trim()
    if (!part) continue
    const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/)
    if (!match) return { pages: [], error: `"${part}" is not a valid range` }

    const start = Number(match[1])
    const end = match[2] ? Number(match[2]) : start
    if (start < 1 || end < 1) return { pages: [], error: 'Pages start at 1' }
    if (start > end) return { pages: [], error: `"${part}" is reversed` }
    if (end > totalPages)
      return { pages: [], error: `Document has only ${totalPages} pages` }

    for (let p = start; p <= end; p++) pages.add(p)
  }

  if (pages.size === 0) return { pages: [], error: 'Enter at least one page' }
  return { pages: [...pages].sort((a, b) => a - b), error: null }
}

/** Compresses [1,2,3,5,7,8] into "1-3, 5, 7-8". */
export function pagesToRange(pages: number[]) {
  if (pages.length === 0) return ''
  const sorted = [...pages].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i]
    if (current === prev + 1) {
      prev = current
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = current
    prev = current
  }
  return parts.join(', ')
}

/**
 * Calculates print cost in poisha based on:
 * - A4 Single: 175 poisha (1.75 TK)
 * - A4 Duplex: 300 poisha per full 2-page sheet + 175 poisha for an odd page
 * - Legal Single: 225 poisha (2.25 TK)
 * - Legal Duplex: 400 poisha per full 2-page sheet + 225 poisha for an odd page
 */
export function calculatePrintCostPoisha(
  selectedPages: number,
  paperSize: PaperSize,
  side: 'single' | 'duplex' | 'SINGLE' | 'DUPLEX',
  copies: number,
): number {
  if (selectedPages <= 0 || copies <= 0) return 0

  const isDuplex = side === 'duplex' || side === 'DUPLEX'
  const isA4 = paperSize === 'A4'
  const singleRate = isA4
    ? PRINT_RATES_POISHA.A4.singlePagePoisha
    : PRINT_RATES_POISHA.Legal.singlePagePoisha
  const duplexSheetRate = isA4
    ? PRINT_RATES_POISHA.A4.duplexSheetPoisha
    : PRINT_RATES_POISHA.Legal.duplexSheetPoisha

  let costPerCopyPoisha: number
  if (isDuplex) {
    const fullSheets = Math.floor(selectedPages / 2)
    const hasOddPage = selectedPages % 2 === 1
    costPerCopyPoisha = fullSheets * duplexSheetRate + (hasOddPage ? singleRate : 0)
  } else {
    costPerCopyPoisha = selectedPages * singleRate
  }

  return costPerCopyPoisha * copies
}

export function calculatePrice(
  selectedPages: number,
  options: {
    color?: string
    paperSize: PaperSize
    side: 'single' | 'duplex' | 'SINGLE' | 'DUPLEX'
    copies: number
    deliveryOption?: string | null
  },
) {
  const isA4 = options.paperSize === 'A4'
  const isDuplex = options.side === 'duplex' || options.side === 'DUPLEX'
  const singleRatePoisha = isA4
    ? PRINT_RATES_POISHA.A4.singlePagePoisha
    : PRINT_RATES_POISHA.Legal.singlePagePoisha
  const duplexSheetRatePoisha = isA4
    ? PRINT_RATES_POISHA.A4.duplexSheetPoisha
    : PRINT_RATES_POISHA.Legal.duplexSheetPoisha

  const printCostPoisha = calculatePrintCostPoisha(
    selectedPages,
    options.paperSize,
    options.side,
    options.copies,
  )

  const deliveryFeePoisha = calculateDeliveryFeePoisha(
    selectedPages,
    options.copies,
    options.deliveryOption,
  )

  const grandTotalPoisha = printCostPoisha + deliveryFeePoisha
  const sheetsPerCopy = isDuplex ? Math.ceil(selectedPages / 2) : selectedPages
  const totalSheets = sheetsPerCopy * options.copies
  const totalPrintedPages = Math.max(0, selectedPages * options.copies)

  return {
    ratePoisha: singleRatePoisha,
    rate: singleRatePoisha / 100,
    duplexSheetRatePoisha,
    duplexSheetRate: duplexSheetRatePoisha / 100,
    printCostPoisha,
    printCost: printCostPoisha / 100,
    deliveryFeePoisha,
    deliveryFee: deliveryFeePoisha / 100,
    grandTotalPoisha,
    grandTotal: grandTotalPoisha / 100,
    sheets: totalSheets,
    totalPrintedPages,
    fullSheetsPerCopy: Math.floor(selectedPages / 2),
    hasOddPage: selectedPages % 2 === 1,
  }
}

export function buildOrderMessageText(params: {
  token?: string | null
  customerName?: string | null
  customerPhone?: string | null
  paperSize: string
  printSide: string
  totalPages: number
  copies: number
  deliveryOption?: string | null
  deliveryAddress?: string | null
  deliveryNotes?: string | null
}): string {
  const tokenText = params.token?.trim() || 'Will be generated on submit'
  const nameText = params.customerName?.trim() || 'Guest / Customer'
  const phoneText = params.customerPhone?.trim() || 'Not provided'
  const paperText = params.paperSize.toUpperCase() === 'LEGAL' ? 'Legal' : 'A4'
  const sideText = params.printSide.toUpperCase() === 'DUPLEX' ? 'Duplex' : 'Single'
  const deliveryOpt = params.deliveryOption?.trim() || 'Flexible / Skip'
  const customPlace = params.deliveryAddress?.trim()
  const deliveryDisplay = customPlace ? `${deliveryOpt} - ${customPlace}` : deliveryOpt
  const notesDisplay = params.deliveryNotes?.trim() || 'None'

  return [
    'Hello PrintKloud! Here are my print job details:',
    `• Order Token: ${tokenText}`,
    `• Name: ${nameText}`,
    `• Phone: ${phoneText}`,
    `• Specs: ${paperText} (${sideText}) | ${params.totalPages} Pages × ${params.copies} Copies`,
    `• Delivery: ${deliveryDisplay}`,
    `• Notes: ${notesDisplay}`,
    '(Attached is my file for printing)',
  ].join('\n')
}
