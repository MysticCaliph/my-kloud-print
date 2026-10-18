'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Fragment } from 'react'
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  PackageCheck,
  Phone,
  Printer,
  Search,
  Truck,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type OrderStatus = 'PENDING' | 'PRINTED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'
type PrintColor = 'B&W' | 'Full color'

interface PrintOrder {
  id: string
  token: string
  phone: string
  deliveryOption: string | null
  pages: number
  color: PrintColor
  copies: number
  total: number
  status: OrderStatus
  placedAt: string
}

const STATUSES: OrderStatus[] = ['PENDING', 'PRINTED', 'DISPATCHED', 'DELIVERED', 'CANCELLED']
const MASTER_STATUSES: OrderStatus[] = ['PENDING', 'PRINTED', 'DISPATCHED', 'DELIVERED']
const FILTERS = ['ALL', ...STATUSES] as const
type StatusFilter = (typeof FILTERS)[number]

const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  PRINTED: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  DISPATCHED: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  DELIVERED: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  CANCELLED: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
}

const CURRENCY = new Intl.NumberFormat('en-BD', {
  maximumFractionDigits: 0,
})

const DATE_TIME = new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const DATE_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function formatBDT(amount: number) {
  return `৳${CURRENCY.format(amount)}`
}

function normalizeStatus(value: string): OrderStatus {
  const status = value.toUpperCase()
  if (
    status === 'PRINTED' ||
    status === 'DISPATCHED' ||
    status === 'DELIVERED' ||
    status === 'CANCELLED'
  ) {
    return status
  }
  return 'PENDING'
}

function formatPlacedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : DATE_TIME.format(date)
}

function getLocalDateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Printer
  accent: string
}) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-[#101722] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">{value}</p>
        </div>
        <span className={`flex size-11 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
        <ArrowUpRight className="size-3.5 text-emerald-400" aria-hidden="true" />
        {hint}
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon =
    status === 'PENDING'
      ? Clock3
      : status === 'PRINTED'
        ? Printer
        : status === 'DISPATCHED'
          ? Truck
          : status === 'DELIVERED'
            ? PackageCheck
            : Check

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] ${STATUS_STYLE[status]}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {status}
    </span>
  )
}

export default function AdminPage() {
  const [orders, setOrders] = useState<PrintOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [actionError, setActionError] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  const fetchPrintJobs = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Admin Fetch Error Details:', error)
        setLoadError(error.message)
        return
      }

      setOrders(
        data.map((job) => {
          return {
            id: job.id,
            token: job.token,
            phone: job.customer_phone,
            deliveryOption: job.delivery_option,
            pages: job.total_pages,
            color: job.color_mode === 'Full Color' || job.color_mode === 'color'
              ? 'Full color'
              : 'B&W',
            copies: job.copies,
            total: Number(job.total_cost_poisha) / 100,
            status: normalizeStatus(job.status),
            placedAt: job.created_at,
          }
        }),
      )
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load print jobs.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPrintJobs()
    const refreshTimer = window.setInterval(() => void fetchPrintJobs(), 15000)
    return () => window.clearInterval(refreshTimer)
  }, [fetchPrintJobs])

  const metrics = useMemo(
    () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return {
        orderCount: orders.filter((order) => new Date(order.placedAt) >= today).length,
        pendingCount: orders.filter((order) => order.status === 'PENDING').length,
        dispatchedCount: orders.filter((order) => order.status === 'DISPATCHED').length,
        revenue: orders.reduce((sum, order) => sum + order.total, 0),
      }
    },
    [orders],
  )

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesFilter = filter === 'ALL' || order.status === filter
      const matchesQuery =
        !normalizedQuery ||
        order.token.toLowerCase().includes(normalizedQuery) ||
        order.phone.toLowerCase().replace(/[\s-]/g, '').includes(normalizedQuery.replace(/[\s-]/g, ''))
      return matchesFilter && matchesQuery
    })
  }, [filter, orders, query])

  const ordersByDate = useMemo<Record<string, PrintOrder[]>>(() => {
    return visibleOrders.reduce<Record<string, PrintOrder[]>>((groups, order) => {
      const dateKey = getLocalDateKey(order.placedAt)
      const dateGroup = groups[dateKey] ?? []
      dateGroup.push(order)
      groups[dateKey] = dateGroup
      return groups
    }, {})
  }, [visibleOrders])

  const groupedDateKeys = useMemo(
    () =>
      Object.keys(ordersByDate).sort((a, b) => {
        if (a === 'unknown') return 1
        if (b === 'unknown') return -1
        return b.localeCompare(a)
      }),
    [ordersByDate],
  )

  async function handleStatusUpdate(jobId: string, newStatus: string) {
    setUpdatingOrderId(jobId)
    setActionError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase
        .from('print_jobs')
        .update({ status: newStatus })
        .eq('id', jobId)
      if (error) {
        alert('Failed to update status: ' + error.message)
        setActionError(error.message)
        return
      }
      setOrders((current) =>
        current.map((order) =>
          order.id === jobId ? { ...order, status: newStatus as OrderStatus } : order,
        ),
      )
      void fetchPrintJobs()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update order status.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100">
      <Navbar />
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <header className="mb-7 flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div>
            <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.13em] text-slate-500">
              OPERATOR
            </span>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Print shop dashboard
            </h1>
            </div>
            <Link
              href="/admin/credits"
              className="inline-flex h-10 items-center rounded-lg border border-teal-300/20 bg-teal-300/10 px-3.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-300/15"
            >
              Manage User Credits
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#101722] px-3.5 py-2.5">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-200">Operator online</p>
                <p className="text-[10px] text-slate-500">KUET · Khulna</p>
              </div>
            </div>
          </div>
        </header>

        <section aria-label="Today's overview" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Today's total orders"
            value={String(metrics.orderCount).padStart(2, '0')}
            hint="Orders received today"
            icon={FileText}
            accent="bg-sky-400/10 text-sky-300"
          />
          <MetricCard
            label="Pending queue"
            value={String(metrics.pendingCount).padStart(2, '0')}
            hint="Waiting to be printed"
            icon={Clock3}
            accent="bg-amber-400/10 text-amber-300"
          />
          <MetricCard
            label="Out for delivery"
            value={String(metrics.dispatchedCount).padStart(2, '0')}
            hint="Currently with a rider"
            icon={Truck}
            accent="bg-violet-400/10 text-violet-300"
          />
          <MetricCard
            label="Total revenue"
            value={formatBDT(metrics.revenue)}
            hint="Gross value of all print jobs"
            icon={CircleDollarSign}
            accent="bg-emerald-400/10 text-emerald-300"
          />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101722] shadow-[0_12px_45px_rgba(0,0,0,0.16)]">
          <div className="flex flex-col gap-5 border-b border-white/[0.07] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">Print queue</h2>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">
                    {visibleOrders.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Review jobs, prepare documents, and move each order through fulfillment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchPrintJobs()}
                className="self-start rounded-lg border border-white/[0.07] bg-[#0b111b] px-3 py-2 text-xs text-slate-400 transition-colors hover:text-slate-200 sm:self-auto"
              >
                Refresh jobs
              </button>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search order token or phone..."
                  aria-label="Search order token or customer phone number"
                  className="h-10 w-full rounded-lg border border-white/[0.09] bg-[#0b111b] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/10"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto rounded-lg border border-white/[0.07] bg-[#0b111b] p-1">
                {FILTERS.map((status) => {
                  const selected = filter === status
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFilter(status)}
                      aria-pressed={selected}
                      className={`shrink-0 rounded-md px-3 py-2 text-[10px] font-semibold tracking-[0.08em] transition-colors ${
                        selected
                          ? 'bg-teal-300/10 text-teal-200 shadow-sm'
                          : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
                      }`}
                    >
                      {status}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {(loadError || actionError) && (
            <p role="alert" className="border-b border-rose-400/20 bg-rose-400/[0.06] px-5 py-3 text-sm text-rose-300">
              {actionError ?? loadError}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.015]">
                  {['ORDER TOKEN', 'CUSTOMER INFO', 'DOCUMENT SPECS', 'TOTAL PRICE', 'STATUS', 'ACTIONS'].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-5 py-3.5 text-[10px] font-semibold tracking-[0.14em] text-slate-500"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.055]">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">
                      Loading print jobs…
                    </td>
                  </tr>
                )}
                {groupedDateKeys.map((dateKey) => {
                  const groupOrders = ordersByDate[dateKey]
                  const groupDate =
                    dateKey === 'unknown' ? null : new Date(`${dateKey}T12:00:00`)
                  const isToday =
                    groupDate?.toLocaleDateString() === new Date().toLocaleDateString()
                  const dateLabel = groupDate
                    ? isToday
                      ? `Today - ${DATE_LABEL.format(groupDate)}`
                      : DATE_LABEL.format(groupDate)
                    : 'Date unavailable'

                  return (
                    <Fragment key={`group-${dateKey}`}>
                      <tr
                        key={`date-${dateKey}`}
                        className="sticky top-[68px] z-20 bg-[#151e2b]"
                      >
                        <th
                          colSpan={6}
                          scope="rowgroup"
                          className="border-y border-white/[0.08] px-5 py-3 text-left text-xs font-semibold text-slate-200 shadow-sm"
                        >
                          <span aria-hidden="true">📅 </span>
                          {dateLabel} ({groupOrders.length} {groupOrders.length === 1 ? 'order' : 'orders'})
                        </th>
                      </tr>
                      {groupOrders.map((order) => {
                  const statusActions =
                    order.status === 'PENDING'
                      ? [
                          { value: 'PRINTED', label: 'Mark Printed' },
                          { value: 'CANCELLED', label: 'Cancel Order' },
                        ]
                      : order.status === 'PRINTED'
                        ? [{ value: 'DISPATCHED', label: 'Out for Delivery' }]
                        : order.status === 'DISPATCHED'
                          ? [{ value: 'DELIVERED', label: 'Mark Delivered' }]
                          : []
                  return (
                    <tr key={order.token} className="transition-colors hover:bg-white/[0.018]">
                      <td className="px-5 py-4 align-middle">
                        <span className="inline-flex rounded-md border border-white/[0.09] bg-[#0b111b] px-2.5 py-1.5 font-mono text-xs font-medium tracking-wide text-teal-200">
                          {order.token}
                        </span>
                        <p className="mt-1.5 text-[11px] text-slate-600">{formatPlacedAt(order.placedAt)}</p>
                      </td>
                      <td className="max-w-[250px] px-5 py-4 align-middle">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                          <Phone className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                          {order.phone}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          Delivery: {order.deliveryOption || 'None'}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                          <FileText className="size-3.5 text-slate-500" aria-hidden="true" />
                          {order.pages} pages
                        </div>
                        <div className="mt-1.5 text-xs text-slate-500">
                          <span className={order.color === 'Full color' ? 'text-fuchsia-300' : 'text-slate-400'}>
                            {order.color}
                          </span>
                          <span className="mx-1.5 text-slate-700">·</span>
                          {order.copies} {order.copies === 1 ? 'copy' : 'copies'}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <span className="font-mono text-sm font-semibold tabular-nums text-slate-100">
                          {formatBDT(order.total)}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => window.open(`/api/print/stamp?id=${order.id}`, '_blank')}
                            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/[0.09] bg-[#151e2b] px-3 text-xs font-medium text-slate-300 transition-colors hover:border-teal-300/30 hover:bg-teal-300/[0.06] hover:text-teal-100"
                          >
                            <ArrowDownToLine className="size-3.5" aria-hidden="true" />
                            Download PDF Stamp
                          </button>
                          {statusActions.length > 0 ? (
                            <label className="relative">
                              <span className="sr-only">Actions for {order.token}</span>
                              <select
                                value=""
                                disabled={updatingOrderId === order.id}
                                onChange={(event) => {
                                  if (event.target.value) {
                                    void handleStatusUpdate(order.id, event.target.value)
                                  }
                                }}
                                className="h-9 appearance-none rounded-lg border border-white/[0.09] bg-[#0b111b] py-0 pl-3 pr-8 text-xs font-medium text-slate-300 outline-none transition-colors hover:border-white/20 focus:border-teal-300/50 disabled:opacity-50"
                              >
                                <option value="">Status action</option>
                                {statusActions.map((action) => (
                                  <option key={action.value} value={action.value}>
                                    {action.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500"
                                aria-hidden="true"
                              />
                            </label>
                          ) : (
                            <span className="inline-flex h-9 items-center gap-1.5 px-2 text-xs text-emerald-300/80">
                              <Check className="size-3.5" aria-hidden="true" />
                              {order.status === 'CANCELLED' ? 'Cancelled' : 'Complete'}
                            </span>
                          )}
                          <label className="relative">
                            <span className="sr-only">Set exact status for {order.token}</span>
                            <select
                              value={MASTER_STATUSES.includes(order.status) ? order.status : ''}
                              disabled={updatingOrderId === order.id}
                              onChange={(event) => {
                                if (event.target.value) {
                                  void handleStatusUpdate(order.id, event.target.value)
                                }
                              }}
                              className="h-9 appearance-none rounded-lg border border-white/[0.09] bg-[#0b111b] py-0 pl-3 pr-8 text-xs font-medium text-slate-300 outline-none transition-colors hover:border-white/20 focus:border-teal-300/50 disabled:opacity-50"
                            >
                              {!MASTER_STATUSES.includes(order.status) && (
                                <option value="">Set status</option>
                              )}
                              {MASTER_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500"
                              aria-hidden="true"
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  )
                      })}
                    </Fragment>
                  )
                })}
                {!isLoading && !loadError && visibleOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500">
                        <Search className="size-5" aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-sm font-medium text-slate-300">
                        {orders.length === 0
                          ? 'No print jobs found.'
                          : 'No print jobs match your search or status filter.'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {orders.length === 0
                          ? 'New print jobs will appear here automatically.'
                          : 'Try another token, phone number, or status filter.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-col gap-2 border-t border-white/[0.07] px-5 py-3.5 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Showing {visibleOrders.length} of {orders.length} print jobs</p>
            <p>Automatically refreshes every 15 seconds</p>
          </footer>
        </section>
      </div>
    </main>
  )
}
