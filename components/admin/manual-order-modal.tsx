'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createAdminManualOrder } from '@/lib/admin-orders'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  calculateManualOrderCostPoisha,
  MANUAL_PRINT_RATES_POISHA,
  type ManualPaperSize,
} from '@/lib/manual-order'
import { formatBDT, type PrintColor } from '@/lib/print'

interface ManualOrderUser {
  id: string
  name: string
  phone: string
  email: string
  wallets:
    | { balance_poisha: number | null }[]
    | { balance_poisha: number | null }
    | null
}

const DELIVERY_OPTIONS = [
  'Get the printed copy next class (8:00 AM - 9:40 AM)',
  'Receive from DR MA Rashid Hall (8:00 PM - 8:30 PM)',
  'Pick up from Laboratory School or Mohona Shop (Anytime)',
  'Skip / Flexible',
] as const

function getWalletBalancePoisha(user: ManualOrderUser | undefined) {
  const wallet = user
    ? Array.isArray(user.wallets)
      ? user.wallets[0]
      : user.wallets
    : null
  return wallet?.balance_poisha ?? null
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
  const [colorMode, setColorMode] = useState<PrintColor>('bw')
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
            value.toLowerCase().includes(term),
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
      ? calculateManualOrderCostPoisha(paperSize, colorMode, pageCount, copyCount)
      : 0
  const totalCostValid = Number.isSafeInteger(totalCostPoisha) && totalCostPoisha > 0
  const walletBalancePoisha = getWalletBalancePoisha(selectedUser)

  function resetForm() {
    setUserSearch('')
    setSelectedUserId('')
    setIsCustomerDropdownOpen(false)
    setActiveCustomerIndex(0)
    setPaperSize('A4')
    setColorMode('bw')
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
        colorMode,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create manual print job</DialogTitle>
          <DialogDescription>
            Create a remote print job for a customer without uploading a PDF.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {userLoadError && (
            <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-300">
              {userLoadError}
            </p>
          )}
          {submitError && (
            <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-300">
              {submitError}
            </p>
          )}

          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="manual-order-customer" className="font-medium">
              Find customer
            </label>
            <div className="relative">
              <input
                id="manual-order-customer"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isCustomerDropdownOpen}
                aria-controls="manual-order-customer-listbox"
                aria-activedescendant={
                  isCustomerDropdownOpen && filteredUsers[activeCustomerIndex]
                    ? `manual-order-customer-${filteredUsers[activeCustomerIndex].id}`
                    : undefined
                }
                aria-required="true"
                autoComplete="off"
                value={
                  isCustomerDropdownOpen
                    ? userSearch
                    : selectedUser
                      ? `${selectedUser.name} · ${selectedUser.phone || selectedUser.email || selectedUser.id}`
                      : userSearch
                }
                onFocus={() => {
                  if (!isCustomerDropdownOpen) {
                    setUserSearch('')
                    setActiveCustomerIndex(0)
                    setIsCustomerDropdownOpen(true)
                  }
                }}
                onBlur={() => {
                  setIsCustomerDropdownOpen(false)
                  setUserSearch('')
                }}
                onChange={(event) => {
                  setUserSearch(event.target.value)
                  setSelectedUserId('')
                  setActiveCustomerIndex(0)
                  setIsCustomerDropdownOpen(true)
                }}
                onKeyDown={handleCustomerKeyDown}
                placeholder={
                  isLoadingUsers
                    ? 'Loading customers…'
                    : 'Search name, phone, or email'
                }
                disabled={isLoadingUsers || Boolean(userLoadError)}
                className="h-10 w-full rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 pr-10 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-300/50 disabled:opacity-50"
              />
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              {isCustomerDropdownOpen && (
                <ul
                  id="manual-order-customer-listbox"
                  role="listbox"
                  aria-label="Customers"
                  className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-white/[0.12] bg-[#101722] p-1 shadow-xl"
                >
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user, index) => {
                      const isSelected = user.id === selectedUserId
                      const isActive = index === activeCustomerIndex
                      return (
                        <li
                          id={`manual-order-customer-${user.id}`}
                          key={user.id}
                          role="option"
                          aria-selected={isSelected}
                          onPointerDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveCustomerIndex(index)}
                          onClick={() => selectCustomer(user)}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 ${
                            isActive
                              ? 'bg-teal-300/10 text-teal-100'
                              : 'text-slate-200 hover:bg-white/[0.05]'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{user.name}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {user.phone || user.email || user.id}
                            </span>
                          </span>
                          {isSelected && (
                            <Check className="size-4 shrink-0 text-teal-300" aria-hidden="true" />
                          )}
                        </li>
                      )
                    })
                  ) : (
                    <li role="status" className="px-3 py-2 text-xs text-slate-500">
                      No customers match your search.
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {selectedUser && (
            <div className="rounded-lg border border-white/[0.08] bg-[#0b111b] px-3 py-2 text-xs text-slate-400">
              <p className="font-medium text-slate-200">{selectedUser.name}</p>
              <p>{selectedUser.phone || 'No phone number on profile'}</p>
              {walletBalancePoisha !== null && (
                <p>Wallet: {formatBDT(walletBalancePoisha / 100)}</p>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Job title (optional)</span>
            <input
              maxLength={200}
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Manual Admin Print Job"
              className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-300/50"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Paper size</span>
              <select
                value={paperSize}
                onChange={(event) =>
                  setPaperSize(event.target.value === 'LEGAL' ? 'LEGAL' : 'A4')
                }
                className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none focus:border-teal-300/50"
              >
                <option value="A4">A4</option>
                <option value="LEGAL">Legal</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Print color</span>
              <select
                value={colorMode}
                onChange={(event) =>
                  setColorMode(event.target.value === 'color' ? 'color' : 'bw')
                }
                className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none focus:border-teal-300/50"
              >
                <option value="bw">Black &amp; White</option>
                <option value="color">Color</option>
              </select>
            </label>
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
            <span className="font-medium">Delivery option</span>
            <select
              required
              value={deliveryOption}
              onChange={(event) => setDeliveryOption(event.target.value)}
              className="h-10 rounded-lg border border-white/[0.12] bg-[#0b111b] px-3 text-sm text-slate-100 outline-none focus:border-teal-300/50"
            >
              <option value="">Select delivery option</option>
              {DELIVERY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#0b111b] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Order total</p>
              <p className="text-xs text-slate-500">
                {pageCountValid && copyCountValid
                  ? `${pageCount} pages × ${copyCount} ${copyCount === 1 ? 'copy' : 'copies'} × ${formatBDT(MANUAL_PRINT_RATES_POISHA[paperSize][colorMode] / 100)}`
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

          <div className="flex justify-end gap-2 border-t border-white/[0.08] pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                isLoadingUsers ||
                !selectedUser ||
                !pageCountValid ||
                !copyCountValid ||
                !totalCostValid ||
                !deliveryOption
              }
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Create print job
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
