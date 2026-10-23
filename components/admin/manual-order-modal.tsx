'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  User,
  Wallet,
  X,
} from 'lucide-react'
import { createAdminManualOrder } from '@/lib/admin-orders'
import {
  calculateManualOrderCostPoisha,
  type ManualPaperSize,
  type ManualPrintSide,
} from '@/lib/manual-order'
import { formatBDT } from '@/lib/print'

interface ManualOrderUser {
  id: string
  name: string
  email: string
  phone: string
  wallets?:
    | {
        balance_poisha: number | string
      }
    | Array<{
        balance_poisha: number | string
      }>
}

const DELIVERY_OPTIONS = [
  'Get the printed copy next class (8:00 AM - 9:40 AM)',
  'Receive from DR MA Rashid Hall (8:00 PM - 8:30 PM)',
  'Pick up from Laboratory School or Mohona Shop (Anytime)',
  'Direct Collection from Shop Counter',
]

function getWalletBalancePoisha(user: ManualOrderUser | undefined) {
  const wallet = user
    ? Array.isArray(user.wallets)
      ? user.wallets[0]
      : user.wallets
    : null
  if (!wallet || wallet.balance_poisha === undefined || wallet.balance_poisha === null) {
    return null
  }
  const parsed = Number(wallet.balance_poisha)
  return Number.isFinite(parsed) ? parsed : null
}

export function ManualOrderModal({
  open,
  onOpenChange,
  onCreated,
  initialUserId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  initialUserId?: string | null
}) {
  const [users, setUsers] = useState<ManualOrderUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [userLoadError, setUserLoadError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0)
  const [paperSize, setPaperSize] = useState<ManualPaperSize>('A4')
  const [printSide, setPrintSide] = useState<ManualPrintSide>('SINGLE')
  const [totalPages, setTotalPages] = useState('1')
  const [copies, setCopies] = useState('1')
  const [deliveryOption, setDeliveryOption] = useState<string>('')
  const [jobTitle, setJobTitle] = useState('')
  const [deductFromWallet, setDeductFromWallet] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setIsLoadingUsers(true)
    setUserLoadError(null)

    void fetch('/api/admin/users', { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as {
          users?: ManualOrderUser[]
          error?: string
        }
        if (!response.ok) throw new Error(result.error ?? 'Could not load customers.')
        const loadedUsers = result.users ?? []
        setUsers(loadedUsers)
        setSelectedUserId(
          initialUserId && loadedUsers.some((user) => user.id === initialUserId)
            ? initialUserId
            : '',
        )
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setUserLoadError(error instanceof Error ? error.message : 'Could not load customers.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingUsers(false)
      })

    return () => controller.abort()
  }, [initialUserId, open])

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase()
    return term
      ? users.filter((user) =>
          [user.name, user.email, user.phone].some((value) =>
            value?.toLowerCase().includes(term),
          ),
        )
      : users
  }, [userSearch, users])

  const selectedUser = users.find((user) => user.id === selectedUserId)
  const pageCount = Number(totalPages)
  const copyCount = Number(copies)
  const pageCountValid = Number.isSafeInteger(pageCount) && pageCount >= 1
  const copyCountValid = Number.isSafeInteger(copyCount) && copyCount >= 1
  const totalCostPoisha =
    pageCountValid && copyCountValid
      ? calculateManualOrderCostPoisha(paperSize, printSide, pageCount, copyCount)
      : 0
  const totalCostValid = Number.isSafeInteger(totalCostPoisha) && totalCostPoisha > 0
  const walletBalancePoisha = getWalletBalancePoisha(selectedUser)

  function resetForm() {
    setUserSearch('')
    setSelectedUserId('')
    setIsCustomerDropdownOpen(false)
    setActiveCustomerIndex(0)
    setPaperSize('A4')
    setPrintSide('SINGLE')
    setTotalPages('1')
    setCopies('1')
    setDeliveryOption('')
    setJobTitle('')
    setDeductFromWallet(false)
    setSubmitError(null)
  }

  function selectCustomer(user: ManualOrderUser) {
    setSelectedUserId(user.id)
    setUserSearch('')
    setIsCustomerDropdownOpen(false)
    setActiveCustomerIndex(0)
    setSubmitError(null)
  }

  function handleCustomerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isCustomerDropdownOpen) {
        setUserSearch('')
        setIsCustomerDropdownOpen(true)
        setActiveCustomerIndex(0)
        return
      }
      if (filteredUsers.length > 0) {
        setActiveCustomerIndex((current) =>
          event.key === 'ArrowDown'
            ? (current + 1) % filteredUsers.length
            : (current - 1 + filteredUsers.length) % filteredUsers.length,
        )
      }
    } else if (event.key === 'Enter' && isCustomerDropdownOpen) {
      if (filteredUsers[activeCustomerIndex]) {
        event.preventDefault()
        selectCustomer(filteredUsers[activeCustomerIndex])
      }
    } else if (event.key === 'Escape') {
      setIsCustomerDropdownOpen(false)
      setUserSearch('')
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedUser || !pageCountValid || !copyCountValid || !totalCostValid) return
    if (
      deductFromWallet &&
      walletBalancePoisha !== null &&
      walletBalancePoisha < totalCostPoisha
    ) {
      setSubmitError('Insufficient wallet balance.')
      return
    }
    if (!deliveryOption) {
      setSubmitError('Select a delivery option.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await createAdminManualOrder({
        userId: selectedUser.id,
        customerName: selectedUser.name,
        customerPhone: selectedUser.phone,
        paperSize,
        printSide,
        totalPages: pageCount,
        copies: copyCount,
        deliveryOption,
        deductFromWallet,
        originalFilename: jobTitle.trim() || 'Manual Admin Job (No PDF)',
      })
      resetForm()
      onOpenChange(false)
      onCreated()
    } catch (err) {
      console.log(err)
      setSubmitError(err instanceof Error ? err.message || String(err) : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-order-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101722] p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="manual-order-title" className="text-lg font-semibold text-white">
              Create manual print job
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Create a physical walk-in job and optionally charge the user wallet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {submitError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="relative">
            <label
              htmlFor="manual-order-customer-search"
              className="mb-1.5 block text-sm font-medium text-slate-200"
            >
              Customer account
            </label>
            <div className="relative">
              <input
                id="manual-order-customer-search"
                type="text"
                autoComplete="off"
                placeholder={
                  isLoadingUsers ? 'Loading customers…' : 'Search name, phone, or email…'
                }
                value={
                  isCustomerDropdownOpen
                    ? userSearch
                    : selectedUser
                      ? `${selectedUser.name} · ${selectedUser.phone || selectedUser.email}`
                      : userSearch
                }
                onFocus={() => {
                  setUserSearch('')
                  setIsCustomerDropdownOpen(true)
                  setActiveCustomerIndex(0)
                }}
                onClick={() => {
                  if (!isCustomerDropdownOpen) {
                    setUserSearch('')
                    setIsCustomerDropdownOpen(true)
                    setActiveCustomerIndex(0)
                  }
                }}
                onChange={(event) => {
                  setUserSearch(event.target.value)
                  setSelectedUserId('')
                  setIsCustomerDropdownOpen(true)
                  setActiveCustomerIndex(0)
                }}
                onKeyDown={handleCustomerKeyDown}
                disabled={isLoadingUsers || Boolean(userLoadError)}
                className="h-10 w-full rounded-lg border border-white/[0.12] bg-[#0b111b] pl-9 pr-8 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-teal-300/50"
              />
              <Search
                className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500"
                aria-hidden="true"
              />
              <ChevronDown
                className="pointer-events-none absolute right-3 top-3 size-4 text-slate-500"
                aria-hidden="true"
              />
            </div>

            {isCustomerDropdownOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-lg border border-white/[0.12] bg-[#0b111b] p-1 shadow-xl">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user, index) => {
                    const isSelected = user.id === selectedUserId
                    const isActive = index === activeCustomerIndex
                    return (
                      <button
                        type="button"
                        key={user.id}
                        onClick={() => selectCustomer(user)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
                          isActive
                            ? 'bg-teal-300/[0.12] text-teal-100'
                            : isSelected
                              ? 'bg-white/[0.06] text-white'
                              : 'text-slate-300 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{user.name}</span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {user.phone || user.email || user.id}
                          </span>
                        </div>
                        {isSelected && <Check className="size-4 shrink-0 text-teal-300" />}
                      </button>
                    )
                  })
                ) : (
                  <p className="px-3 py-2 text-xs text-slate-500">No matching customers.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Paper size</span>
              <select
                value={paperSize}
                onChange={(event) =>
                  setPaperSize(event.target.value === 'LEGAL' ? 'LEGAL' : 'A4')
                }
                className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none focus:border-teal-300/50"
              >
                <option value="A4">A4 (৳1.75 Single / ৳3.00 Duplex)</option>
                <option value="LEGAL">Legal (৳2.25 Single / ৳4.00 Duplex)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Print side</span>
              <select
                value={printSide}
                onChange={(event) =>
                  setPrintSide(event.target.value === 'DUPLEX' ? 'DUPLEX' : 'SINGLE')
                }
                className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none focus:border-teal-300/50"
              >
                <option value="SINGLE">Single-sided</option>
                <option value="DUPLEX">Duplex (Both sides)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Page count</span>
              <input
                required
                type="number"
                min={1}
                max={2_147_483_647}
                step={1}
                value={totalPages}
                onChange={(event) => setTotalPages(event.target.value)}
                className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none focus:border-teal-300/50"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Copies</span>
              <input
                required
                type="number"
                min={1}
                max={2_147_483_647}
                step={1}
                value={copies}
                onChange={(event) => setCopies(event.target.value)}
                className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none focus:border-teal-300/50"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Job title / reference (optional)</span>
            <input
              type="text"
              placeholder="e.g. Lab Report 1"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-teal-300/50"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Delivery arrangement</span>
            <select
              value={deliveryOption}
              onChange={(event) => setDeliveryOption(event.target.value)}
              required
              className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none focus:border-teal-300/50"
            >
              <option value="">Select an arrangement…</option>
              {DELIVERY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#0b111b] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Order total</p>
              <p className="text-xs text-slate-500">
                {pageCountValid && copyCountValid
                  ? `${pageCount} pages · ${printSide === 'DUPLEX' ? 'Duplex' : 'Single'} · ${copyCount} ${copyCount === 1 ? 'copy' : 'copies'}`
                  : 'Enter a valid page and copy count'}
              </p>
            </div>
            <p className="font-mono text-lg font-semibold tabular-nums text-teal-200">
              {totalCostValid ? formatBDT(totalCostPoisha / 100) : '—'}
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={deductFromWallet}
              onChange={(event) => setDeductFromWallet(event.target.checked)}
              className="mt-0.5 size-4 accent-teal-400"
            />
            <span>Deduct cost from user wallet balance</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-lg px-4 text-sm font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedUser || !pageCountValid || !copyCountValid}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-200 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Job'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
