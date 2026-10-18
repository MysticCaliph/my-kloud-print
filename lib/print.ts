export type PrintColor = 'bw' | 'color'
export type PaperSize = 'A4' | 'Legal'
export type PrintSide = 'single' | 'duplex'

export interface PrintOptions {
  color: PrintColor
  paperSize: PaperSize
  side: PrintSide
  copies: number
}

export const PRINT_RATES_POISHA: Record<PaperSize, Record<PrintColor, number>> = {
  A4: { bw: 175, color: 275 },
  Legal: { bw: 200, color: 325 },
}

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

export function calculatePrice(selectedPages: number, options: PrintOptions) {
  const ratePoisha = PRINT_RATES_POISHA[options.paperSize][options.color]
  const printCostPoisha = selectedPages * options.copies * ratePoisha
  const sheetsPerCopy =
    options.side === 'duplex' ? Math.ceil(selectedPages / 2) : selectedPages

  return {
    ratePoisha,
    rate: ratePoisha / 100,
    printCostPoisha,
    printCost: printCostPoisha / 100,
    grandTotalPoisha: printCostPoisha,
    grandTotal: printCostPoisha / 100,
    sheets: sheetsPerCopy * options.copies,
  }
}
