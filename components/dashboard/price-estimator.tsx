import { Calculator } from 'lucide-react'
import { formatBDT, type PrintOptions, type calculatePrice } from '@/lib/print'

interface PriceEstimatorProps {
  selectedPages: number
  options: PrintOptions
  price: ReturnType<typeof calculatePrice>
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className={muted ? 'text-muted-foreground' : undefined}>{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  )
}

export function PriceEstimator({ selectedPages, options, price }: PriceEstimatorProps) {
  return (
    <section aria-labelledby="estimate-heading" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calculator className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="estimate-heading" className="text-base font-semibold">
          Instant estimate
        </h2>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-center font-mono text-xs text-muted-foreground tabular-nums">
        <span className="text-foreground">{selectedPages}</span> pages ×{' '}
        <span className="text-foreground">{formatBDT(price.rate)}</span> ×{' '}
        <span className="text-foreground">{options.copies}</span>{' '}
        {options.copies === 1 ? 'copy' : 'copies'}
      </div>

      <dl className="flex flex-col gap-2.5" aria-live="polite">
        <Row label="Selected pages" value={`${selectedPages}`} muted />
        <Row
          label={`Rate (${options.color === 'bw' ? 'B&W' : 'Color'})`}
          value={`${formatBDT(price.rate)}/page`}
          muted
        />
        <Row label="Copies" value={`× ${options.copies}`} muted />
        <Row label="Printing subtotal" value={formatBDT(price.printCost)} />

        <div className="my-1 border-t border-border" />

        <div className="flex items-end justify-between gap-4">
          <dt className="text-sm font-medium">Grand total</dt>
          <dd className="font-mono text-3xl font-semibold tracking-tight text-primary tabular-nums">
            {formatBDT(price.grandTotal)}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        {options.paperSize} · {options.side === 'duplex' ? 'Duplex' : 'Single-sided'} ·{' '}
        {price.sheets} {price.sheets === 1 ? 'sheet' : 'sheets'} of paper
      </p>
    </section>
  )
}
