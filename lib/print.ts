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

  const totalCostPoisha = calculatePrintCostPoisha(
    selectedPages,
    options.paperSize,
    options.side,
    options.copies,
  )

  const sheetsPerCopy = isDuplex ? Math.ceil(selectedPages / 2) : selectedPages
  const totalSheets = sheetsPerCopy * options.copies

  return {
    ratePoisha: singleRatePoisha,
    rate: singleRatePoisha / 100,
    duplexSheetRatePoisha,
    duplexSheetRate: duplexSheetRatePoisha / 100,
    printCostPoisha: totalCostPoisha,
    printCost: totalCostPoisha / 100,
    grandTotalPoisha: totalCostPoisha,
    grandTotal: totalCostPoisha / 100,
    sheets: totalSheets,
    fullSheetsPerCopy: Math.floor(selectedPages / 2),
    hasOddPage: selectedPages % 2 === 1,
  }
}
