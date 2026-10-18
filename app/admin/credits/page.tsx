'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Plus, Search, Wallet } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { ManualOrderModal } from '@/components/admin/manual-order-modal'

interface CreditUser {
  id: string
  name: string
  phone: string
  email: string
  wallets:
    | { balance_poisha: number | null }[]
    | { balance_poisha: number | null }
    | null
}

const PRESET_AMOUNTS = [50, 100, 200, 500]
function formatBDT(amount: number) {
  return `৳${amount.toFixed(2)}`
}

export default function AdminCreditsPage() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<CreditUser[]>([])
  const [selectedUser, setSelectedUser] = useState<CreditUser | null>(null)
  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false)
  const [manualOrderUserId, setManualOrderUserId] = useState<string | null>(null)
  const [amountBdt, setAmountBdt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/admin/users', { signal })
    const result = (await response.json()) as { users?: CreditUser[]; error?: string }
    if (!response.ok) throw new Error(result.error ?? 'Could not load users.')
    const loadedUsers = result.users ?? []
    setUsers(loadedUsers)
    return loadedUsers
  }, [])

  const refreshUsers = useCallback(async () => {
    const refreshedUsers = await fetchUsers()
    setSelectedUser((current) =>
      current
        ? refreshedUsers.find((user) => user.id === current.id) ?? current
        : current,
    )
  }, [fetchUsers])

  useEffect(() => {
    const controller = new AbortController()
    void fetchUsers(controller.signal)
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : 'Could not load users.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [fetchUsers])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) =>
      [user.name, user.email, user.phone].some((value) => value.toLowerCase().includes(term)),
    )
  }, [query, users])
  const selectedWalletData = selectedUser
    ? Array.isArray(selectedUser.wallets)
      ? selectedUser.wallets[0]
      : selectedUser.wallets
    : null
  const selectedBalancePoisha = selectedWalletData?.balance_poisha ?? 0
  const selectedBalanceBdt = (selectedBalancePoisha / 100).toFixed(2)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedUser) return
    const amount = Number(amountBdt)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than ৳0.00.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setToast(null)
    try {
      const response = await fetch('/api/admin/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: selectedUser.id, amountBdt: amount }),
      })
      const result = (await response.json()) as { success?: boolean; message?: string; error?: string }
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? 'Could not add wallet credit.')
      }
      const refreshedUsers = await fetchUsers()
      setSelectedUser(
        refreshedUsers.find((user) => user.id === selectedUser.id) ?? selectedUser,
      )
      setToast(result.message ?? `Successfully added ${formatBDT(amount)} credit`)
      setAmountBdt('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not add wallet credit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Admin Dashboard
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            User Wallet &amp; Credit Management
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Find a customer and add credit to their wallet.
          </p>
        </header>

        {toast && (
          <div
            role="status"
            className="fixed right-4 top-20 z-50 flex max-w-md items-start gap-3 rounded-xl border border-emerald-400/25 bg-[#101d1b] px-4 py-3 text-sm text-emerald-100 shadow-xl"
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <span>{toast}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-white/[0.08] bg-[#101722] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="user-search" className="text-sm font-medium text-slate-200">
              Search users
            </label>
            <button
              type="button"
              onClick={() => {
                setManualOrderUserId(null)
                setIsManualOrderOpen(true)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 text-xs font-medium text-sky-100 transition-colors hover:bg-sky-300/15"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Create Manual Print Job
            </button>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              id="user-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedUser(null)
              }}
              placeholder="Search by name, email, or phone"
              className="h-11 w-full rounded-lg border border-white/10 bg-[#0b111b] pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
            />
          </div>

          {isLoading && <p className="mt-4 text-sm text-slate-500">Loading users…</p>}
          {!isLoading && filteredUsers.length === 0 && !error && (
            <p className="mt-4 text-sm text-slate-500">
              {users.length === 0 ? 'No users found.' : 'No users match your search.'}
            </p>
          )}

          {filteredUsers.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.07]">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-white/[0.025]">
                  <tr className="border-b border-white/[0.07]">
                    {['Name', 'Email', 'Phone', 'Current Balance', ''].map((heading, index) => (
                      <th
                        key={`${heading}-${index}`}
                        scope="col"
                        className="px-4 py-3 text-xs font-medium text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredUsers.map((user) => {
                    const walletData = Array.isArray(user.wallets) ? user.wallets[0] : user.wallets
                    const balancePoisha = walletData?.balance_poisha ?? 0
                    const balanceBdt = (balancePoisha / 100).toFixed(2)
                    return (
                      <tr key={user.id} className="bg-[#0b111b]">
                        <td className="px-4 py-3 text-sm font-medium text-slate-100">{user.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{user.email || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{user.phone || '—'}</td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-teal-100">
                          ৳{balanceBdt}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(user)
                                setAmountBdt('')
                                setError(null)
                              }}
                              className="rounded-lg border border-teal-300/20 bg-teal-300/10 px-3 py-2 text-xs font-medium text-teal-100 transition-colors hover:bg-teal-300/15"
                            >
                              Add Credit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setManualOrderUserId(user.id)
                                setIsManualOrderOpen(true)
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-medium text-sky-100 transition-colors hover:bg-sky-300/15"
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              Create Manual Print Job
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selectedUser && (
            <form onSubmit={handleSubmit} className="mt-7 border-t border-white/[0.08] pt-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-teal-300/10 text-teal-200">
                  <Wallet className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Add credit to {selectedUser.name}</p>
                  <p className="text-xs text-slate-400">
                    Current balance: ৳{selectedBalanceBdt}
                  </p>
                </div>
              </div>

              <label htmlFor="credit-amount" className="text-sm font-medium text-slate-200">
                Amount in BDT (৳)
              </label>
              <div className="mt-2 flex max-w-sm items-center rounded-lg border border-white/10 bg-[#0b111b] px-3 focus-within:border-teal-300/50">
                <span className="text-slate-500">৳</span>
                <input
                  id="credit-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={amountBdt}
                  onChange={(event) => setAmountBdt(event.target.value)}
                  placeholder="Enter amount"
                  className="h-11 w-full bg-transparent px-2 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setAmountBdt(String(amount))}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-teal-300/40 hover:bg-teal-300/10 hover:text-teal-100"
                  >
                    +৳{amount.toFixed(2)}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !amountBdt}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-teal-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Adding credit…' : 'Add Credit to User Wallet'}
              </button>
            </form>
          )}
        </section>
      </main>
      <ManualOrderModal
        open={isManualOrderOpen}
        onOpenChange={setIsManualOrderOpen}
        initialUserId={manualOrderUserId}
        onCreated={() => {
          setToast('Manual print job created.')
          void refreshUsers().catch((refreshError: unknown) => {
            setError(
              refreshError instanceof Error
                ? refreshError.message
                : 'Could not refresh wallet balances.',
            )
          })
        }}
      />
    </>
  )
}
