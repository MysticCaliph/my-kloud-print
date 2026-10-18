'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatBDT } from '@/lib/print'

interface TopUpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBalance: number
  suggestedAmount?: number
  onConfirm: (amount: number) => Promise<void>
}

const PRESETS = [50, 100, 200, 500]
const MIN_TOPUP = 10
const MAX_TOPUP = 25000

export function TopUpModal({
  open,
  onOpenChange,
  currentBalance,
  suggestedAmount,
  onConfirm,
}: TopUpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {open && (
          <TopUpForm
            currentBalance={currentBalance}
            suggestedAmount={suggestedAmount}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TopUpForm({
  currentBalance,
  suggestedAmount,
  onConfirm,
}: Omit<TopUpModalProps, 'open' | 'onOpenChange'>) {
  const [amount, setAmount] = useState(() =>
    suggestedAmount ? String(Math.ceil(suggestedAmount)) : '',
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numericAmount = Number(amount)
  const isValid =
    Number.isFinite(numericAmount) && numericAmount >= MIN_TOPUP && numericAmount <= MAX_TOPUP
  const showError = amount !== '' && !isValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || isProcessing) return
    setError(null)
    setIsProcessing(true)
    try {
      await onConfirm(numericAmount)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not start the bKash payment.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="h-1.5 bg-bkash" aria-hidden="true" />
      <div className="flex flex-col gap-5 p-6">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 items-center rounded-md bg-bkash px-2 text-xs font-bold tracking-wide text-bkash-foreground">
              bKash
            </span>
            <DialogTitle className="text-lg font-semibold">Top up wallet</DialogTitle>
          </div>
          <DialogDescription>
            Current balance:{' '}
            <span className="font-mono font-medium text-foreground">
              {formatBDT(currentBalance)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="topup-amount" className="text-sm font-medium">
            Amount (BDT)
          </label>
          <div
            className={cn(
              'flex h-14 items-center gap-2 rounded-lg border bg-background px-4 transition-colors focus-within:ring-3',
              showError
                ? 'border-destructive focus-within:ring-destructive/20'
                : 'border-input focus-within:border-bkash focus-within:ring-bkash/25',
            )}
          >
            <span className="text-2xl font-semibold text-muted-foreground" aria-hidden="true">
              ৳
            </span>
            <input
              id="topup-amount"
              type="number"
              inputMode="decimal"
              min={MIN_TOPUP}
              max={MAX_TOPUP}
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={showError}
              aria-describedby="topup-hint"
              autoFocus
              className="w-full [appearance:textfield] bg-transparent font-mono text-2xl font-semibold tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <p
            id="topup-hint"
            className={cn('text-xs', showError ? 'text-destructive' : 'text-muted-foreground')}
          >
            {showError
              ? `Enter an amount between ${formatBDT(MIN_TOPUP)} and ${formatBDT(MAX_TOPUP)}.`
              : `Min ${formatBDT(MIN_TOPUP)} · Max ${formatBDT(MAX_TOPUP)} per transaction`}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Preset amounts">
          {PRESETS.map((preset) => {
            const active = numericAmount === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                aria-pressed={active}
                className={cn(
                  'h-11 rounded-lg border font-mono text-sm font-semibold transition-colors',
                  active
                    ? 'border-bkash bg-bkash/15 text-bkash'
                    : 'border-border bg-background/50 hover:border-bkash/50',
                )}
              >
                {formatBDT(preset)}
              </button>
            )
          })}
        </div>

        {isValid && (
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">New balance</span>
            <span className="font-mono font-semibold tabular-nums">
              {formatBDT(currentBalance + numericAmount)}
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={!isValid || isProcessing}
          className="h-12 gap-2 bg-bkash text-base font-semibold text-bkash-foreground hover:bg-bkash/90 focus-visible:ring-bkash/40"
        >
          {isProcessing && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {isProcessing
            ? 'Starting payment…'
            : isValid
              ? `Continue · ${formatBDT(numericAmount)}`
              : 'Continue with top-up'}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          Demo checkout only; no real bKash payment is processed.
        </p>
      </div>
    </form>
  )
}
