'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  PackageCheck,
  Phone,
  Printer,
  Wallet,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { AccountDialog } from '@/components/dashboard/account-dialog'
import { Button } from '@/components/ui/button'
import { UserAvatar, MaleAvatarSvg, FemaleAvatarSvg } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'
import type { AccountPrintOrder, WalletTransaction } from '@/lib/account-store'
import { generateManualJobReceiptPdf } from '@/lib/pdf-stamper'
import { formatBDT } from '@/lib/print'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSupabaseAccount } from '@/lib/supabase/use-account'

type AccountTab = 'orders' | 'ledger' | 'notifications'

interface AccountNotification {
  id: string
  type: string
  title: string
  message: string
  created_at: string
  is_read: boolean
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'medium',
})

function formatDate(value: string, short = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return (short ? SHORT_DATE_FORMAT : DATE_FORMAT).format(date)
}

function OrderStatus({ status }: { status: AccountPrintOrder['status'] }) {
  const style =
    status === 'QUEUED'
      ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
      : status === 'PRINTED'
        ? 'border-sky-400/25 bg-sky-400/10 text-sky-300'
        : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wider ${style}`}>
      {status}
    </span>
  )
}

function TransactionStatus({ status }: { status: WalletTransaction['status'] }) {
  const completed = status === 'COMPLETED'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        completed ? 'text-emerald-400' : 'text-rose-400'
      }`}
    >
      {completed ? (
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
      ) : (
        <Clock3 className="size-3.5" aria-hidden="true" />
      )}
      {status}
    </span>
  )
}

export default function AccountPage() {
  const { account, refresh, error: accountError, isLoading } = useSupabaseAccount()
  const [activeTab, setActiveTab] = useState<AccountTab>('orders')
  const [orders, setOrders] = useState<AccountPrintOrder[]>([])
  const [ledger, setLedger] = useState<WalletTransaction[]>([])
  const [notifications, setNotifications] = useState<AccountNotification[]>([])
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadingToken, setDownloadingToken] = useState<string | null>(null)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)

  async function handleAvatarUpdate(type: 'male' | 'female') {
    if (!account || account.avatarType === type || isUpdatingAvatar) return
    setIsUpdatingAvatar(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_type: type })
        .eq('id', account.id)
      if (error) throw error
      await supabase.auth.updateUser({ data: { avatar_type: type } }).catch(() => {})
      await refresh()
    } catch (err) {
      console.error('Failed to update avatar:', err)
    } finally {
      setIsUpdatingAvatar(false)
    }
  }

  useEffect(() => {
    if (!account) {
      setOrders([])
      setLedger([])
      setNotifications([])
      return
    }
    let active = true
    const refreshActivity = async () => {
      setActivityError(null)
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('print_jobs')
        .select(
          'token, created_at, total_pages, original_filename, paper_size, color_mode, print_side, upload_method, copies, delivery_address, total_cost_poisha, status, file_storage_path',
        )
        .eq('user_id', account.id)
        .order('created_at', { ascending: false })
      const {
        data: notificationData,
        error: notificationLoadError,
      } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', account.id)
        .order('created_at', { ascending: false })
      if (!active) return
      if (error) {
        setActivityError(error.message)
        setOrders([])
      } else {
        setOrders(
          data.map((job) => ({
            token: job.token,
            submittedAt: job.created_at,
            fileName: job.original_filename || 'Print job document',
            pages: job.total_pages,
            paperSize: job.paper_size === 'LEGAL' ? 'Legal' : job.paper_size,
            color: 'B&W',
            printSide: job.print_side === 'DUPLEX' ? 'DUPLEX' : 'SINGLE',
            uploadMethod: job.upload_method || 'DIRECT',




            copies: job.copies,
            address: job.delivery_address,
            total: job.total_cost_poisha / 100,
            fileStoragePath: job.file_storage_path,
            status:
              job.status === 'PRINTED' || job.status === 'DELIVERED'
                ? job.status
                : 'QUEUED',
          })),
        )
      }
      if (notificationLoadError) {
        setNotificationError(notificationLoadError.message)
        setNotifications([])
      } else {
        setNotificationError(null)
        setNotifications(
          (notificationData ?? []).map((notification) => {
            const row = notification as typeof notification & {
              type?: string
              notification_type?: string
            }
            return {
              id: row.id,
              type: row.type ?? row.notification_type ?? '',
              title: row.title ?? 'Notification',
              message: row.message ?? '',
              created_at: row.created_at,
              is_read: Boolean(row.is_read),
            }
          }),
        )
      }
      setLedger([])
    }
    void refreshActivity()
    return () => {
      active = false
    }
  }, [account])

  async function handleDownloadStampedPdf(order: AccountPrintOrder) {
    setDownloadingToken(order.token)
    setDownloadError(null)
    try {
      const pdfBlob = await generateManualJobReceiptPdf({
        order_token: order.token,
        customer_name: account?.name,
        customer_phone: account?.phone,
        upload_method: order.uploadMethod || 'DIRECT',
        job_title: order.fileName,
        paper_size: order.paperSize,
        print_side: order.printSide || 'SINGLE',
        print_type: order.color,
        page_count: order.pages,
        total_pages: order.pages,
        copies: order.copies,
        total_price: order.total,
        created_at: order.submittedAt,
        customer_info: account
          ? `${account.name}${account.phone ? ` - ${account.phone}` : ''}`
          : undefined,
      })
      const url = URL.createObjectURL(pdfBlob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `PrintKloud-Stamp-${order.token}.pdf`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      const reason = error instanceof Error ? ` ${error.message}` : ''
      setDownloadError(`Could not prepare the stamped copy.${reason}`)
    } finally {
      setDownloadingToken(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              My account
            </h1>
            <p className="mt-1 text-sm text-slate-400">Profile, print orders, and wallet activity.</p>
          </div>
          <span className="hidden size-11 items-center justify-center rounded-xl border border-teal-300/15 bg-teal-300/10 text-teal-200 sm:flex">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
        </header>

        {account ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <article className="rounded-2xl border border-white/[0.08] bg-[#101722] p-5 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl border border-teal-300/20 bg-teal-300/10">
                    <UserAvatar type={account.avatarType} className="size-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      Account profile
                    </p>
                    <h2 className="mt-1 truncate text-xl font-semibold text-white">{account.name}</h2>
                    <p className="mt-0.5 truncate text-sm text-slate-400">{account.email}</p>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Avatar:</span>
                      <button
                        type="button"
                        disabled={isUpdatingAvatar}
                        onClick={() => void handleAvatarUpdate('male')}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                          account.avatarType === 'male'
                            ? 'border-teal-400/40 bg-teal-400/10 text-teal-300'
                            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white',
                        )}
                      >
                        <div className="size-4 overflow-hidden rounded-sm">
                          <MaleAvatarSvg className="size-full" />
                        </div>
                        Male
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingAvatar}
                        onClick={() => void handleAvatarUpdate('female')}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                          account.avatarType === 'female'
                            ? 'border-pink-400/40 bg-pink-400/10 text-pink-300'
                            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white',
                        )}
                      >
                        <div className="size-4 overflow-hidden rounded-sm">
                          <FemaleAvatarSvg className="size-full" />
                        </div>
                        Female
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Phone number</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Phone className="size-3.5 text-slate-500" aria-hidden="true" />
                      <span className="text-sm text-slate-200">{account.phone || 'Not added'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Account created</p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-200">
                      <CalendarDays className="size-3.5 text-slate-500" aria-hidden="true" />
                      {account.createdAt ? formatDate(account.createdAt, true) : 'Date unavailable'}
                    </div>
                  </div>
                </div>
              </article>

              <article className="relative overflow-hidden rounded-2xl border border-pink-300/15 bg-[linear-gradient(135deg,#27111f_0%,#171321_53%,#101722_100%)] p-5 sm:p-7">
                <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-pink-500/[0.09] blur-3xl" />
                <div className="relative flex h-full flex-col justify-between gap-7">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-pink-100">
                      <Wallet className="size-4" aria-hidden="true" />
                      PrintKloud wallet
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-400">
                      Available balance
                    </p>
                    <p className="mt-2 font-mono text-4xl font-semibold tracking-tight text-white">
                      {account.balance === null ? 'Unavailable' : formatBDT(account.balance)}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-slate-300">
                    Need to top up your wallet? Pay cash to an operator at the print shop or request credit.
                  </p>
                </div>
              </article>
            </section>

            <section className="mt-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101722]">
              <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 pt-5 sm:px-6 sm:pt-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Your activity</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Follow print jobs, wallet activity, and account notifications.
                  </p>
                </div>
                <div className="flex gap-5" role="tablist" aria-label="Account activity">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'orders'}
                    onClick={() => setActiveTab('orders')}
                    className={`border-b-2 px-0.5 pb-3 text-sm font-medium transition-colors ${
                      activeTab === 'orders'
                        ? 'border-teal-300 text-teal-200'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    My Print Orders
                    <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">
                      {orders.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'ledger'}
                    onClick={() => setActiveTab('ledger')}
                    className={`border-b-2 px-0.5 pb-3 text-sm font-medium transition-colors ${
                      activeTab === 'ledger'
                        ? 'border-teal-300 text-teal-200'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Wallet Ledger
                    <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">
                      {ledger.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'notifications'}
                    onClick={() => setActiveTab('notifications')}
                    className={`border-b-2 px-0.5 pb-3 text-sm font-medium transition-colors ${
                      activeTab === 'notifications'
                        ? 'border-teal-300 text-teal-200'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Notifications
                    <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">
                      {notifications.length}
                    </span>
                  </button>
                </div>
              </div>

              {activeTab === 'orders' ? (
                <>
                  {activityError && (
                    <p role="alert" className="border-b border-rose-400/20 bg-rose-400/[0.06] px-5 py-3 text-sm text-rose-300">
                      Could not load print orders: {activityError}
                    </p>
                  )}
                  {downloadError && (
                    <p role="alert" className="border-b border-rose-400/20 bg-rose-400/[0.06] px-5 py-3 text-sm text-rose-300">
                      {downloadError}
                    </p>
                  )}
                  {orders.length > 0 ? (
                    <div className="divide-y divide-white/[0.06]">
                      {orders.map((order) => (
                        <article key={order.token} className="p-5 sm:p-6">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="rounded-md border border-white/[0.09] bg-[#0b111b] px-2.5 py-1.5 font-mono text-xs font-semibold text-teal-200">
                                  {order.token}
                                </span>
                                <OrderStatus status={order.status} />
                                <span className="text-xs text-slate-500">
                                  {formatDate(order.submittedAt)}
                                </span>
                              </div>
                              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-100">
                                <FileText className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                                <span className="truncate">{order.fileName}</span>
                              </div>
                              <div className="mt-3 grid gap-x-6 gap-y-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-3">
                                <p>{order.pages} pages · {order.paperSize} · {order.printSide === 'DUPLEX' ? 'Duplex' : 'Single'} · B&W · {order.copies} {order.copies === 1 ? 'copy' : 'copies'}</p>
                                <p className="flex items-start gap-1.5">
                                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                                  {order.address}
                                </p>
                                <p className="font-mono font-semibold text-slate-200">
                                  Total {formatBDT(order.total)}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => void handleDownloadStampedPdf(order)}
                              disabled={downloadingToken === order.token}
                              className="h-9 shrink-0 gap-2 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
                            >
                              <ArrowDownToLine className="size-4" aria-hidden="true" />
                              {downloadingToken === order.token ? 'Preparing…' : 'Download Stamped Copy'}
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Printer}
                      title="No print orders yet"
                      description="Your orders will appear here after you submit a print job while signed in."
                      action={
                        <Link
                          href="/"
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-300 px-3 text-sm font-medium text-slate-950 transition-colors hover:bg-teal-200"
                        >
                          <Printer className="size-4" aria-hidden="true" />
                          Start a print job
                        </Link>
                      }
                    />
                  )}
                </>
              ) : activeTab === 'notifications' ? (
                <>
                  {notificationError && (
                    <p role="alert" className="border-b border-rose-400/20 bg-rose-400/[0.06] px-5 py-3 text-sm text-rose-300">
                      Could not load notifications: {notificationError}
                    </p>
                  )}
                  {notifications.length > 0 ? (
                    <div className="divide-y divide-white/[0.06]">
                      {notifications.map((notification) => {
                        const isCreditNotification = notification.type === 'CREDIT_ADDED'
                        const isJobNotification = notification.type === 'JOB_STATUS_UPDATE'
                        const NotificationIcon = isCreditNotification
                          ? Wallet
                          : isJobNotification
                            ? PackageCheck
                            : Bell
                        return (
                          <article
                            key={notification.id}
                            className="flex items-start gap-4 px-5 py-4 sm:px-6"
                          >
                            <span
                              className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${
                                isCreditNotification
                                  ? 'bg-emerald-400/10 text-emerald-300'
                                  : isJobNotification
                                    ? 'bg-sky-400/10 text-sky-300'
                                    : 'bg-white/[0.05] text-slate-300'
                              }`}
                            >
                              <NotificationIcon className="size-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <h3 className="text-sm font-semibold text-slate-100">
                                  {notification.title}
                                </h3>
                                <time
                                  dateTime={notification.created_at}
                                  className="text-xs text-slate-500"
                                >
                                  {formatDate(notification.created_at)}
                                </time>
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-400">
                                {notification.message}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                notification.is_read
                                  ? 'border-white/[0.08] text-slate-500'
                                  : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                              }`}
                            >
                              {notification.is_read ? 'Read' : 'Unread'}
                            </span>
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Bell}
                      title="No notifications yet"
                      description="Updates about wallet credits and print job status will appear here."
                      action={<span />}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="border-b border-amber-300/10 bg-amber-300/[0.04] px-5 py-3 text-xs text-amber-100/70 sm:px-6">
                    Wallet transaction history is not available until a transaction ledger is configured.
                  </div>
                  {ledger.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            {['DATE', 'TYPE', 'AMOUNT', 'BKASH TRANSACTION ID', 'STATUS'].map((heading) => (
                              <th key={heading} className="px-5 py-3.5 text-[10px] font-semibold tracking-[0.13em] text-slate-500 sm:px-6">
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {ledger.map((transaction) => {
                            const topUp = transaction.type === 'TOP_UP'
                            return (
                              <tr key={transaction.id} className="hover:bg-white/[0.015]">
                                <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400 sm:px-6">
                                  {formatDate(transaction.date)}
                                </td>
                                <td className={`px-5 py-4 text-sm font-medium sm:px-6 ${topUp ? 'text-emerald-300' : 'text-rose-300'}`}>
                                  {transaction.description}
                                </td>
                                <td className={`whitespace-nowrap px-5 py-4 font-mono text-sm font-semibold tabular-nums sm:px-6 ${topUp ? 'text-emerald-300' : 'text-rose-300'}`}>
                                  {topUp ? '+' : '−'}{formatBDT(Math.abs(transaction.amount))}
                                </td>
                                <td className="px-5 py-4 font-mono text-xs text-slate-400 sm:px-6">
                                  {transaction.trxId ?? 'Not available'}
                                </td>
                                <td className="px-5 py-4 sm:px-6">
                                  <TransactionStatus status={transaction.status} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Wallet}
                      title="Wallet ledger unavailable"
                      description="Transaction history will appear here when wallet transaction records are available."
                      action={
                        <p className="max-w-md text-sm leading-6 text-slate-400">
                          Need to top up your wallet? Pay cash to an operator at the print shop or request credit.
                        </p>
                      }
                    />
                  )}
                </>
              )}
            </section>
          </>
        ) : accountError ? (
          <section className="mx-auto mt-14 max-w-lg rounded-2xl border border-rose-400/20 bg-[#101722] px-6 py-10 text-center">
            <h2 className="text-lg font-semibold text-white">Could not load your account</h2>
            <p role="alert" className="mt-2 text-sm leading-6 text-rose-200">{accountError}</p>
            <Button
              onClick={() => void refresh()}
              className="mt-5 h-10 bg-teal-300 px-5 font-semibold text-slate-950 hover:bg-teal-200"
            >
              Try again
            </Button>
          </section>
        ) : isLoading ? (
          <section className="mx-auto mt-14 max-w-lg rounded-2xl border border-white/[0.08] bg-[#101722] px-6 py-10 text-center text-sm text-slate-400">
            Loading your account…
          </section>
        ) : (
          <section className="mx-auto mt-14 max-w-lg rounded-2xl border border-white/[0.08] bg-[#101722] px-6 py-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-teal-300/10 text-teal-200">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-white">Sign in to view your account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Sign in or create an account to access your wallet, print orders, and transaction history.
            </p>
            <Button
              onClick={() => setIsAccountDialogOpen(true)}
              className="mt-5 h-10 bg-teal-300 px-5 font-semibold text-slate-950 hover:bg-teal-200"
            >
              Sign in / Create account
            </Button>
          </section>
        )}

      </div>

      <AccountDialog
        open={isAccountDialogOpen}
        onOpenChange={setIsAccountDialogOpen}
        account={account}
      />
    </main>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Wallet
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.045] text-slate-500">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  )
}
