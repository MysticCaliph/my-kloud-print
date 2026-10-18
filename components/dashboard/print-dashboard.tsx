'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { calculatePrice, formatBDT, pagesToRange, type PrintOptions } from '@/lib/print'
import { Navbar } from '@/components/Navbar'
import { useSupabaseAccount } from '@/lib/supabase/use-account'
import { UploadZone, type UploadedPdf } from './upload-zone'
import { PrintOptionsPanel } from './print-options-panel'
import { PriceEstimator } from './price-estimator'
import { SubmitAction } from './submit-action'
import { AccountDialog } from './account-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const DEFAULT_OPTIONS: PrintOptions = {
  color: 'bw',
  paperSize: 'A4',
  side: 'single',
  copies: 1,
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function PrintDashboard() {
  const { account, refresh } = useSupabaseAccount()
  const balance = account?.balance ?? null
  const [file, setFile] = useState<UploadedPdf | null>(null)
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [deliveryOption, setDeliveryOption] = useState<string>('')
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_OPTIONS)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isCheckoutPromptOpen, setIsCheckoutPromptOpen] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [lastJob, setLastJob] = useState<{
    name: string
    total: number
    paymentMethod: 'wallet' | 'delivery'
    token?: string
  } | null>(null)

  const price = calculatePrice(selectedPages.length, options)
  const hasJob = Boolean(file) && selectedPages.length > 0

  async function handleSubmit(continueAsGuest = isGuest) {
    if (!file || !hasJob) return
    if (account && (balance === null || price.grandTotal > balance)) return
    if (!account && !continueAsGuest) {
      setIsCheckoutPromptOpen(true)
      return
    }
    setSubmissionError(null)
    setIsSubmitting(true)
    try {
      if (!account) {
        if (continueAsGuest) {
          await wait(1000)
          setLastJob({ name: file.name, total: price.grandTotal, paymentMethod: 'delivery' })
        }
      } else {
        if (!account.phone.trim()) {
          throw new Error('Add a phone number to your account before submitting a print job.')
        }
        const formData = new FormData()
        formData.append('file', file.file, file.name)
        formData.append('userId', account.id)
        formData.append('totalPages', String(file.pageCount))
        formData.append('selectedPages', JSON.stringify(selectedPages))
        formData.append(
          'pageRange',
          selectedPages.length === file.pageCount ? 'All' : pagesToRange(selectedPages),
        )
        formData.append('colorMode', options.color)
        formData.append('copies', String(options.copies))
        formData.append('totalCostPoisha', String(Math.round(price.grandTotal * 100)))
        formData.append('customerPhone', account.phone)
        formData.append('deliveryOption', deliveryOption)

        const response = await fetch('/api/print/submit', {
          method: 'POST',
          body: formData,
        })
        const result = (await response.json()) as {
          success?: boolean
          token?: string
          error?: string
        }
        if (!response.ok || !result.success || !result.token) {
          throw new Error(result.error ?? 'Order submission failed. Please try again.')
        }
        setLastJob({
          name: file.name,
          total: price.grandTotal,
          paymentMethod: 'wallet',
          token: result.token,
        })
        await refresh()
      }
      setFile(null)
      setSelectedPages([])
      setOptions(DEFAULT_OPTIONS)
      setDeliveryOption('')
      setIsGuest(false)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Order submission failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <TooltipProvider>
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            New print job
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Upload a PDF, choose your print options, and select an optional delivery method.
          </p>
        </div>

        {lastJob && (
          <div
            role="status"
            className="mb-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
          >
            <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="min-w-0 flex-1">
              <span className="font-medium">Job submitted.</span>{' '}
              <span className="text-muted-foreground">
                <span className="break-all">{lastJob.name}</span>{' '}
                {lastJob.paymentMethod === 'wallet' ? (
                  <>
                    <span className="mr-1 font-mono font-semibold text-primary">{lastJob.token}</span>
                    was submitted and <span className="font-mono text-foreground">{formatBDT(lastJob.total)}</span>{' '}
                    was charged from your wallet.
                  </>
                ) : (
                  <>
                    was submitted. Pay <span className="font-mono text-foreground">{formatBDT(lastJob.total)}</span>{' '}
                    on delivery.
                  </>
                )}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setLastJob(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}
        {submissionError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {submissionError}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex min-w-0 flex-col gap-6">
            <UploadZone
              key={lastJob?.name ?? 'upload'}
              file={file}
              onFileChange={setFile}
              selectedPages={selectedPages}
              onSelectedPagesChange={setSelectedPages}
            />
            <PrintOptionsPanel options={options} onChange={setOptions} />
            <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <fieldset>
                <legend className="text-sm font-semibold">Delivery method (optional)</legend>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose a convenient handoff, or skip for a flexible arrangement.
                </p>
                <div className="mt-3 grid gap-2">
                  {[
                    'Get the printed copy next class (8:00 AM - 9:40 AM)',
                    'Receive from DR MA Rashid Hall (8:00 PM - 8:30 PM)',
                    'Pick up from Laboratory School or Mohona Shop (Anytime)',
                  ].map((option) => {
                    const isSelected = deliveryOption === option
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setDeliveryOption(isSelected ? '' : option)}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background/50 hover:border-muted-foreground/40'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? 'border-primary bg-primary' : 'border-input'
                          }`}
                        >
                          {isSelected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                        </span>
                        {option}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!deliveryOption}
                    onClick={() => setDeliveryOption('')}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                      !deliveryOption
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background/50 hover:border-muted-foreground/40'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        !deliveryOption ? 'border-primary bg-primary' : 'border-input'
                      }`}
                    >
                      {!deliveryOption && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    Skip / Flexible
                  </button>
                </div>
              </fieldset>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 sm:p-6">
              <PriceEstimator
                selectedPages={selectedPages.length}
                options={options}
                price={price}
              />
              {account ? (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Wallet balance</span>
                  <span className="font-mono font-medium tabular-nums">
                    {balance === null ? 'Unavailable' : formatBDT(balance)}
                  </span>
                </div>
              ) : null}
              <SubmitAction
                isSignedIn={Boolean(account)}
                isWalletReady={balance !== null}
                isGuest={isGuest && !account}
                hasJob={hasJob}
                balance={balance}
                grandTotal={price.grandTotal}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
              />
            </div>
          </aside>
        </div>
      </main>

      <AccountDialog
        open={isAccountOpen}
        onOpenChange={setIsAccountOpen}
        account={account}
      />

      <Dialog open={isCheckoutPromptOpen} onOpenChange={setIsCheckoutPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How would you like to submit?</DialogTitle>
            <DialogDescription>
              Sign in to pay from your wallet, or continue as a guest and pay on delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsCheckoutPromptOpen(false)
                setIsAccountOpen(true)
              }}
            >
              Sign in / Create account
            </Button>
            <Button
              onClick={() => {
                setIsCheckoutPromptOpen(false)
                setIsGuest(true)
                void handleSubmit(true)
              }}
            >
              Continue as guest
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  )
}
