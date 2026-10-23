'use client'

import { useState } from 'react'
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileUp,
  MapPin,
  MessageCircle,
  Send,
  StickyNote,
} from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  CUSTOM_DELIVERY_OPTION,
  buildOrderMessageText,
  calculatePrice,
  formatBDT,
  isCustomDeliveryOption,
  pagesToRange,
  type PaperSize,
  type PrintOptions,
  type UploadMethod,
} from '@/lib/print'
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
import { cn } from '@/lib/utils'

const DEFAULT_OPTIONS: PrintOptions = {
  color: 'bw',
  paperSize: 'A4',
  side: 'single',
  copies: 1,
}

const STANDARD_DELIVERY_OPTIONS = [
  'Get the printed copy next class (8:00 AM - 9:40 AM)',
  'Receive from DR MA Rashid Hall (8:00 PM - 8:30 PM)',
  'Pick up from Laboratory School or Mohona Shop (Anytime)',
] as const

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function CopyableOrderMessageBox({
  messageText,
  uploadMethod,
  title,
  subtitle,
}: {
  messageText: string
  uploadMethod: UploadMethod
  title?: string
  subtitle?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(messageText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = messageText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    }
  }

  const encodedText = encodeURIComponent(messageText)
  const isWhatsapp = uploadMethod === 'WHATSAPP'

  return (
    <div className="rounded-xl border border-border bg-background/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
            {title || `Copy-Paste Order Message for ${isWhatsapp ? 'WhatsApp' : 'Telegram'}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subtitle ||
              'Copy this pre-formatted message and send it along with your document to 01518962340.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors',
            copied
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25',
          )}
        >
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              Copied! ✓
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden="true" />
              Copy Message
            </>
          )}
        </button>
      </div>

      <textarea
        readOnly
        value={messageText}
        rows={8}
        onClick={(e) => e.currentTarget.select()}
        aria-label="Order details message template"
        className="mt-3 w-full resize-none rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-primary"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {isWhatsapp ? (
          <a
            href={`https://wa.me/8801518962340?text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow transition-colors hover:bg-emerald-500"
          >
            <MessageCircle className="size-4" />
            Open WhatsApp (01518962340) with Pre-filled Text
            <ExternalLink className="size-3.5 opacity-75" />
          </a>
        ) : (
          <a
            href={`https://t.me/+8801518962340?text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-600 px-3.5 text-xs font-semibold text-white shadow transition-colors hover:bg-sky-500"
          >
            <Send className="size-4" />
            Open Telegram (01518962340) with Pre-filled Text
            <ExternalLink className="size-3.5 opacity-75" />
          </a>
        )}
      </div>
    </div>
  )
}

export function PrintDashboard() {
  const { account, refresh } = useSupabaseAccount()
  const balance = account?.balance ?? null

  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('DIRECT')
  const [file, setFile] = useState<UploadedPdf | null>(null)
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [manualPageCount, setManualPageCount] = useState<number>(1)
  const [deliveryOption, setDeliveryOption] = useState<string>('')
  const [customDeliveryAddress, setCustomDeliveryAddress] = useState<string>('')
  const [printingNotes, setPrintingNotes] = useState<string>('')
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_OPTIONS)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isCheckoutPromptOpen, setIsCheckoutPromptOpen] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  const [lastJob, setLastJob] = useState<{
    name: string
    total: number
    printCost: number
    deliveryFee: number
    paymentMethod: 'wallet' | 'delivery'
    token: string
    uploadMethod: UploadMethod
    paperSize: PaperSize
    printSide: 'single' | 'duplex'
    pages: number
    copies: number
    customerName: string
    customerPhone: string
    deliveryOption: string
    deliveryAddress: string
    deliveryNotes: string
    jobId?: string
  } | null>(null)

  const effectivePageCount =
    uploadMethod === 'DIRECT'
      ? selectedPages.length
      : Math.max(1, Math.floor(manualPageCount) || 1)

  const isCustomPlace = isCustomDeliveryOption(deliveryOption)

  const price = calculatePrice(effectivePageCount, {
    ...options,
    deliveryOption,
  })

  const hasJob =
    uploadMethod === 'DIRECT'
      ? Boolean(file) && selectedPages.length > 0
      : manualPageCount >= 1

  const liveOrderMessageText = buildOrderMessageText({
    token: null,
    customerName: account?.name || 'Customer',
    customerPhone: account?.phone || 'Not provided',
    paperSize: options.paperSize,
    printSide: options.side,
    totalPages: effectivePageCount,
    copies: options.copies,
    deliveryOption: deliveryOption || 'Flexible / Skip',
    deliveryAddress: isCustomPlace ? customDeliveryAddress : '',
    deliveryNotes: printingNotes,
  })

  const confirmedOrderMessageText = lastJob
    ? buildOrderMessageText({
        token: lastJob.token,
        customerName: lastJob.customerName,
        customerPhone: lastJob.customerPhone,
        paperSize: lastJob.paperSize,
        printSide: lastJob.printSide,
        totalPages: lastJob.pages,
        copies: lastJob.copies,
        deliveryOption: lastJob.deliveryOption || 'Flexible / Skip',
        deliveryAddress: lastJob.deliveryAddress,
        deliveryNotes: lastJob.deliveryNotes,
      })
    : ''

  async function handleSubmit(continueAsGuest = isGuest) {
    if (!hasJob) return
    if (isCustomPlace && !customDeliveryAddress.trim()) {
      setSubmissionError(
        'Please enter your custom delivery location / place name for "Any Other Place (Charge Applicable)".',
      )
      return
    }
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
          const dummyToken = `#PRT-${Math.floor(1000 + Math.random() * 9000)}-GUEST`
          setLastJob({
            name: uploadMethod === 'DIRECT' ? file?.name || 'Document' : `${uploadMethod} Print`,
            total: price.grandTotal,
            printCost: price.printCost,
            deliveryFee: price.deliveryFee,
            paymentMethod: 'delivery',
            token: dummyToken,
            uploadMethod,
            paperSize: options.paperSize,
            printSide: options.side,
            pages: effectivePageCount,
            copies: options.copies,
            customerName: 'Guest Customer',
            customerPhone: 'On Delivery',
            deliveryOption: deliveryOption || 'Flexible / Skip',
            deliveryAddress: isCustomPlace ? customDeliveryAddress.trim() : '',
            deliveryNotes: printingNotes.trim(),
          })
        }
      } else {
        if (!account.phone.trim()) {
          throw new Error('Add a phone number to your account before submitting a print job.')
        }

        const formData = new FormData()
        formData.append('userId', account.id)
        formData.append('uploadMethod', uploadMethod)
        formData.append('totalPages', String(effectivePageCount))
        formData.append('paperSize', options.paperSize)
        formData.append('printSide', options.side === 'duplex' ? 'DUPLEX' : 'SINGLE')
        formData.append('colorMode', 'bw')
        formData.append('copies', String(options.copies))
        formData.append('totalCostPoisha', String(price.grandTotalPoisha))
        formData.append('customerPhone', account.phone)
        formData.append('deliveryOption', deliveryOption)
        if (isCustomPlace && customDeliveryAddress.trim()) {
          formData.append('deliveryAddress', customDeliveryAddress.trim())
        }
        if (printingNotes.trim()) {
          formData.append('deliveryNotes', printingNotes.trim())
        }

        if (uploadMethod === 'DIRECT' && file) {
          formData.append('file', file.file, file.name)
          formData.append('selectedPages', JSON.stringify(selectedPages))
          formData.append(
            'pageRange',
            selectedPages.length === file.pageCount ? 'All' : pagesToRange(selectedPages),
          )
        }

        const response = await fetch('/api/print/submit', {
          method: 'POST',
          body: formData,
        })
        const result = (await response.json()) as {
          success?: boolean
          token?: string
          job_id?: string
          error?: string
        }

        if (!response.ok || !result.success || !result.token) {
          throw new Error(result.error ?? 'Order submission failed. Please try again.')
        }

        setLastJob({
          name: uploadMethod === 'DIRECT' ? file?.name || 'Document' : `${uploadMethod} Order`,
          total: price.grandTotal,
          printCost: price.printCost,
          deliveryFee: price.deliveryFee,
          paymentMethod: 'wallet',
          token: result.token,
          uploadMethod,
          paperSize: options.paperSize,
          printSide: options.side,
          pages: effectivePageCount,
          copies: options.copies,
          customerName: account.name || 'Customer',
          customerPhone: account.phone,
          deliveryOption: deliveryOption || 'Flexible / Skip',
          deliveryAddress: isCustomPlace ? customDeliveryAddress.trim() : '',
          deliveryNotes: printingNotes.trim(),
          jobId: result.job_id,
        })
        await refresh()
      }

      setFile(null)
      setSelectedPages([])
      setOptions(DEFAULT_OPTIONS)
      setDeliveryOption('')
      setCustomDeliveryAddress('')
      setPrintingNotes('')
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
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl text-foreground">
            New print job
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Choose your document upload method, select print specifications, and arrange delivery.
          </p>
        </div>

        {/* Success Alert Banner with WhatsApp / Telegram actions */}
        {lastJob && (
          <div
            role="status"
            className="mb-8 overflow-hidden rounded-2xl border border-primary/40 bg-primary/10 p-5 shadow-lg"
          >
            <div className="flex items-start gap-3.5">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    Order Submitted Successfully!
                  </h3>
                  <span className="font-mono text-sm font-bold text-primary">
                    {lastJob.token}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Charged{' '}
                  <span className="font-mono font-medium text-foreground">
                    {formatBDT(lastJob.total)}
                  </span>{' '}
                  from your wallet ({lastJob.pages} pages · {lastJob.paperSize} ·{' '}
                  {lastJob.printSide === 'duplex' ? 'Duplex' : 'Single'} · x{lastJob.copies}{' '}
                  copies
                  {lastJob.deliveryFee > 0
                    ? ` · includes ${formatBDT(lastJob.deliveryFee)} delivery charge`
                    : ''}
                  ).
                </p>

                {/* Copyable message box & direct links for WhatsApp / Telegram orders */}
                {(lastJob.uploadMethod === 'WHATSAPP' || lastJob.uploadMethod === 'TELEGRAM') && (
                  <div className="mt-4">
                    <CopyableOrderMessageBox
                      messageText={confirmedOrderMessageText}
                      uploadMethod={lastJob.uploadMethod}
                      title={`Step 2: Copy & Send Your Order Message via ${
                        lastJob.uploadMethod === 'WHATSAPP' ? 'WhatsApp' : 'Telegram'
                      } (01518962340)`}
                      subtitle={`Your Order Token (${lastJob.token}) is now included below. Copy or click the button to send with your file.`}
                    />
                  </div>
                )}

                {/* Receipt button for all orders */}
                {lastJob.jobId && (
                  <div className="mt-3.5 flex items-center gap-3">
                    <a
                      href={`/api/print/stamp?id=${lastJob.jobId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <ArrowDownToLine className="size-3.5" />
                      Download Official Order Receipt
                    </a>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setLastJob(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
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
            {/* 1. Upload Method Selector */}
            <section
              aria-labelledby="method-heading"
              className="rounded-xl border border-border bg-card p-5 sm:p-6"
            >
              <h2 id="method-heading" className="mb-1 text-base font-semibold">
                1. Select Document Upload Method
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Upload your PDF directly (up to 50 MB) or submit specs and send via WhatsApp / Telegram.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Direct Upload Option */}
                <button
                  type="button"
                  onClick={() => setUploadMethod('DIRECT')}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                    uploadMethod === 'DIRECT'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                      : 'border-border bg-background/50 hover:border-muted-foreground/40',
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <FileUp className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Direct Upload</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Upload PDF file (Max 50 MB limit)
                    </p>
                  </div>
                </button>

                {/* WhatsApp Option */}
                <button
                  type="button"
                  onClick={() => setUploadMethod('WHATSAPP')}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                    uploadMethod === 'WHATSAPP'
                      ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/40'
                      : 'border-border bg-background/50 hover:border-muted-foreground/40',
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <MessageCircle className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">WhatsApp</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      01518962340 (Standard WhatsApp limits)
                    </p>
                  </div>
                </button>

                {/* Telegram Option */}
                <button
                  type="button"
                  onClick={() => setUploadMethod('TELEGRAM')}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                    uploadMethod === 'TELEGRAM'
                      ? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/40'
                      : 'border-border bg-background/50 hover:border-muted-foreground/40',
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                    <Send className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Telegram</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      01518962340 (Send file with Order token)
                    </p>
                  </div>
                </button>
              </div>

              {/* Upload Body based on selected method */}
              <div className="mt-5">
                {uploadMethod === 'DIRECT' ? (
                  <UploadZone
                    key={lastJob?.token ?? 'upload-direct'}
                    file={file}
                    onFileChange={setFile}
                    selectedPages={selectedPages}
                    onSelectedPagesChange={setSelectedPages}
                  />
                ) : (
                  <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {uploadMethod === 'WHATSAPP' ? 'WhatsApp' : 'Telegram'} File Submission
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Enter the total pages of your document. Submit the order to generate your Order Token, then send the file to{' '}
                            <span className="font-semibold text-foreground">01518962340</span>.
                          </p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            uploadMethod === 'WHATSAPP'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-sky-500/20 text-sky-300',
                          )}
                        >
                          {uploadMethod}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-3">
                        <label
                          htmlFor="page-count-input"
                          className="text-sm font-medium text-foreground whitespace-nowrap"
                        >
                          Total Page Count:
                        </label>
                        <input
                          id="page-count-input"
                          type="number"
                          min={1}
                          max={2000}
                          value={manualPageCount}
                          onChange={(e) =>
                            setManualPageCount(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))
                          }
                          className="h-10 w-28 rounded-lg border border-border bg-background px-3 font-mono text-sm font-semibold text-foreground outline-none focus:border-primary"
                        />
                        <span className="text-xs text-muted-foreground">pages in document</span>
                      </div>
                    </div>

                    {/* Live Copy-Pasteable Message Preview */}
                    <CopyableOrderMessageBox
                      messageText={liveOrderMessageText}
                      uploadMethod={uploadMethod}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* 2. Print Options Panel */}
            <PrintOptionsPanel options={options} onChange={setOptions} />

            {/* 3. Additional Printing Instructions / Notes (Optional) */}
            <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <StickyNote className="size-4 text-primary" aria-hidden="true" />
                <label
                  htmlFor="printing-notes-textarea"
                  className="text-sm font-semibold text-foreground"
                >
                  Additional Printing Instructions / Notes (Optional)
                </label>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Add any special page instructions, binding preferences, or finishing notes for the print operator.
              </p>
              <textarea
                id="printing-notes-textarea"
                rows={3}
                maxLength={500}
                value={printingNotes}
                onChange={(e) => setPrintingNotes(e.target.value)}
                placeholder="Print page 1-10 only, staple top-left, spiral bind, etc."
                className="mt-3 w-full rounded-lg border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </section>

            {/* 4. Delivery Method */}
            <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <fieldset>
                <legend className="text-sm font-semibold">Delivery arrangement (optional)</legend>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose a free campus pickup/handoff point, or select custom delivery to any other place.
                </p>
                <div className="mt-3 grid gap-2">
                  {STANDARD_DELIVERY_OPTIONS.map((option) => {
                    const isSelected = deliveryOption === option
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setDeliveryOption(isSelected ? '' : option)}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background/50 hover:border-muted-foreground/40'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                              isSelected ? 'border-primary bg-primary' : 'border-input'
                            }`}
                          >
                            {isSelected && (
                              <span className="size-1.5 rounded-full bg-primary-foreground" />
                            )}
                          </span>
                          <span>{option}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                          Free
                        </span>
                      </button>
                    )
                  })}

                  {/* Any Other Place (Charge Applicable) */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isCustomPlace}
                    onClick={() =>
                      setDeliveryOption(isCustomPlace ? '' : CUSTOM_DELIVERY_OPTION)
                    }
                    className={`flex flex-col gap-1.5 rounded-lg border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                      isCustomPlace
                        ? 'border-amber-500/60 bg-amber-500/10'
                        : 'border-border bg-background/50 hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="flex items-center gap-3 font-medium">
                        <span
                          aria-hidden="true"
                          className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                            isCustomPlace ? 'border-amber-400 bg-amber-400' : 'border-input'
                          }`}
                        >
                          {isCustomPlace && (
                            <span className="size-1.5 rounded-full bg-slate-950" />
                          )}
                        </span>
                        <span>{CUSTOM_DELIVERY_OPTION}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                        +৳20 / +৳30
                      </span>
                    </div>
                    <p className="pl-7 text-xs text-muted-foreground">
                      Tiered fee by total printed pages (pages × copies):{' '}
                      <span className="font-medium text-foreground">≤ 50 pages = ৳20.00</span> ·{' '}
                      <span className="font-medium text-foreground">&gt; 50 pages = ৳30.00</span>
                    </p>
                  </button>

                  {/* Custom delivery location input when "Any Other Place" is chosen */}
                  {isCustomPlace && (
                    <div className="mt-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
                      <label
                        htmlFor="custom-delivery-place"
                        className="flex items-center gap-1.5 text-xs font-semibold text-amber-200"
                      >
                        <MapPin className="size-3.5 text-amber-400" aria-hidden="true" />
                        Delivery Location / Place Name (Required) *
                      </label>
                      <input
                        id="custom-delivery-place"
                        type="text"
                        required
                        maxLength={200}
                        value={customDeliveryAddress}
                        onChange={(e) => setCustomDeliveryAddress(e.target.value)}
                        placeholder="e.g., Lalan Shah Hall Room 304, Pocket Gate, Fulbarigate..."
                        className="mt-2 h-10 w-full rounded-lg border border-amber-500/40 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                      />
                      <p className="mt-1.5 text-[11px] text-amber-300/80">
                        Current job ({price.totalPrintedPages} total printed pages):{' '}
                        <span className="font-mono font-semibold">
                          +{formatBDT(price.deliveryFee)}
                        </span>{' '}
                        delivery charge applied.
                      </p>
                    </div>
                  )}

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
                      {!deliveryOption && (
                        <span className="size-1.5 rounded-full bg-primary-foreground" />
                      )}
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
                selectedPages={effectivePageCount}
                options={options}
                price={price}
                deliveryOption={deliveryOption}
                deliveryAddress={isCustomPlace ? customDeliveryAddress : ''}
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
