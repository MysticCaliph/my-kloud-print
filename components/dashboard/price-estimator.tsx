import { Calculator, Truck } from 'lucide-react'
import { formatBDT, type PrintOptions, type calculatePrice } from '@/lib/print'

interface PriceEstimatorProps {
  selectedPages: number
  options: PrintOptions
  price: ReturnType<typeof calculatePrice>
  deliveryOption?: string
  deliveryAddress?: string
}

function Row({
  label,
  value,
  muted,
  highlight,
}: {
  label: string
  value: string
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt
        className={
          highlight
            ? 'font-medium text-amber-300'
            : muted
              ? 'text-muted-foreground'
              : 'font-medium text-foreground'
        }
      >
        {label}
      </dt>
      <dd
        className={
          highlight
            ? 'font-mono font-semibold tabular-nums text-amber-300'
            : 'font-mono tabular-nums'
        }
      >
        {value}
      </dd>
    </div>
  )
}

export function PriceEstimator({
  selectedPages,
  options,
  price,
  deliveryAddress,
}: PriceEstimatorProps) {
  const isDuplex = options.side === 'duplex'
  const isA4 = options.paperSize === 'A4'
  const hasDeliveryFee = price.deliveryFeePoisha > 0

  return (
    <section aria-labelledby="estimate-heading" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calculator className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="estimate-heading" className="text-base font-semibold">
          Instant estimate
        </h2>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-center font-mono text-xs text-muted-foreground tabular-nums">
        {isDuplex ? (
          <>
            <span className="text-foreground">{selectedPages}</span> pages (
            <span className="text-foreground">{price.sheets / options.copies}</span> sheets/copy) ×{' '}
            <span className="text-foreground">{options.copies}</span>{' '}
            {options.copies === 1 ? 'copy' : 'copies'}
          </>
        ) : (
          <>
            <span className="text-foreground">{selectedPages}</span> pages ×{' '}
            <span className="text-foreground">{formatBDT(price.rate)}</span> ×{' '}
            <span className="text-foreground">{options.copies}</span>{' '}
            {options.copies === 1 ? 'copy' : 'copies'}
          </>
        )}
      </div>

      <dl className="flex flex-col gap-2.5" aria-live="polite">
        <Row label="Selected pages" value={`${selectedPages}`} muted />
        <Row label="Print mode" value="Black & White" muted />
        <Row
          label={`Rate (${options.paperSize} ${isDuplex ? 'Duplex' : 'Single'})`}
          value={
            isDuplex
              ? `${formatBDT(isA4 ? 3.0 : 4.0)}/sheet`
              : `${formatBDT(price.rate)}/page`
          }
          muted
        />
        <Row label="Copies" value={`× ${options.copies}`} muted />
        <Row
          label="Total printed pages"
          value={`${price.totalPrintedPages} ${price.totalPrintedPages === 1 ? 'page' : 'pages'}`}
          muted
        />

        <div className="my-0.5 border-t border-border/60" />

        <Row label="Printing Cost" value={formatBDT(price.printCost)} />
        <Row
          label={
            hasDeliveryFee
              ? `Delivery Charge (${price.totalPrintedPages <= 50 ? '≤50 pgs' : '>50 pgs'})`
              : 'Delivery Charge'
          }
          value={hasDeliveryFee ? `+ ${formatBDT(price.deliveryFee)}` : '৳0.00 (Free)'}
          muted={!hasDeliveryFee}
          highlight={hasDeliveryFee}
        />

        {hasDeliveryFee && deliveryAddress?.trim() && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
            <Truck className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Place: {deliveryAddress.trim()}</span>
          </div>
        )}

        <div className="my-1 border-t border-border" />

        <div className="flex items-end justify-between gap-4">
          <dt className="text-sm font-semibold">Total Cost</dt>
          <dd className="font-mono text-3xl font-semibold tracking-tight text-primary tabular-nums">
            {formatBDT(price.grandTotal)}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        {options.paperSize} · {isDuplex ? 'Duplex (double-sided)' : 'Single-sided'} ·{' '}
        {price.sheets} {price.sheets === 1 ? 'sheet' : 'sheets'} of paper
        {hasDeliveryFee ? ` · Includes ${formatBDT(price.deliveryFee)} delivery fee` : ''}
      </p>
    </section>
  )
}
