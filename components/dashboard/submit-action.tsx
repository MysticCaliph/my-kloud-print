'use client'

import { AlertTriangle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBDT } from '@/lib/print'

interface SubmitActionProps {
  isSignedIn: boolean
  isWalletReady?: boolean
  isGuest: boolean
  hasJob: boolean
  balance: number | null
  grandTotal: number
  isSubmitting: boolean
  onSubmit: () => void
}

export function SubmitAction({
  isSignedIn,
  isWalletReady = true,
  isGuest,
  hasJob,
  balance,
  grandTotal,
  isSubmitting,
  onSubmit,
}: SubmitActionProps) {
  const shortfall = Math.max(0, grandTotal - (balance ?? 0))
  const isInsufficient = isSignedIn && isWalletReady && hasJob && shortfall > 0
  const walletUnavailable = isSignedIn && !isWalletReady
  const disabled = !hasJob || isInsufficient || walletUnavailable || isSubmitting

  const disabledReason = walletUnavailable
    ? 'Wallet balance is unavailable. Please reload or try again later.'
    : !hasJob
    ? 'Upload a PDF and select at least one page to continue.'
    : isInsufficient
      ? `Insufficient balance. You need ${formatBDT(shortfall)} more to submit this job.`
      : null

  const button = (
    <Button
      onClick={onSubmit}
      disabled={disabled}
      className="h-12 w-full gap-2 text-base font-semibold"
    >
      {isSubmitting ? (
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      ) : (
        <Send className="size-4" aria-hidden="true" />
      )}
      {isSubmitting
        ? 'Submitting…'
        : isGuest
          ? 'Submit Print Job · Pay on Delivery'
          : 'Pay & Submit Print Job'}
    </Button>
  )

  return (
    <div className="flex flex-col gap-3">
      {disabledReason && !isSubmitting ? (
        <Tooltip>
          <TooltipTrigger
            render={<span tabIndex={0} className="block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />}
            aria-label={disabledReason}
          >
            {button}
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            {disabledReason}
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      {isInsufficient && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-foreground">
              Short by <span className="font-mono font-semibold">{formatBDT(shortfall)}</span>
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Please pay cash to an operator at the print shop to top up your wallet balance.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
