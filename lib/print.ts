export type PrintColor = 'bw' | 'color'
export type PaperSize = 'A4' | 'Legal'
export type PrintSide = 'single' | 'duplex'

export interface PrintOptions {
  color: PrintColor
  paperSize: PaperSize
  side: PrintSide
  copies: number
}

export const COLOR_RATES: Record<PrintColor, number> = {
  bw: 1.5,
  color: 2.5,
}

export const MAX_COPIES = 99

const bdtFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function formatBDT(amount: number) {
  return `৳${bdtFormatter.format(amount)}`
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
  const rate = COLOR_RATES[options.color]
  const printCost = selectedPages * rate * options.copies
  const sheetsPerCopy =
    options.side === 'duplex' ? Math.ceil(selectedPages / 2) : selectedPages

  return {
    rate,
    printCost,
    grandTotal: printCost,
    sheets: sheetsPerCopy * options.copies,
  }
}
