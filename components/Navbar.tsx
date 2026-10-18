'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronDown,
  Bell,
  LogIn,
  LogOut,
  Menu,
  Printer,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { AccountDialog } from '@/components/dashboard/account-dialog'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSupabaseAccount } from '@/lib/supabase/use-account'
import { formatBDT } from '@/lib/print'

const NAV_LINKS = [
  { label: 'New Print Job', href: '/' },
  { label: 'My Account & Wallet', href: '/account' },
] as const

interface UserNotification {
  id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
}

const NOTIFICATION_TIME = new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatNotificationTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : NOTIFICATION_TIME.format(date)
}

export function Navbar() {
  const pathname = usePathname()
  const { account } = useSupabaseAccount()
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)

  const refetchNotifications = useCallback(async () => {
    if (!account) {
      setNotifications([])
      setNotificationError(null)
      return
    }

    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user || user.id !== account.id) {
      setNotifications([])
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error
    setNotifications((data ?? []) as UserNotification[])
    setNotificationError(null)
  }, [account?.id])

  useEffect(() => {
    if (!account) {
      setNotifications([])
      setNotificationError(null)
      return
    }

    setNotifications([])
    setNotificationError(null)
    let active = true
    const refresh = async () => {
      try {
        await refetchNotifications()
      } catch (error) {
        console.error('Notification fetch failed:', error)
        if (active) {
          setNotificationError('Could not load notifications.')
        }
      }
    }

    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [account?.id, refetchNotifications])

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  async function getNotificationUserId() {
    if (!account) throw new Error('Sign in to manage notifications.')
    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error) throw error
    if (!user || user.id !== account.id) throw new Error('Could not verify the signed-in user.')
    return { supabase, userId: user.id }
  }

  async function markAllNotificationsRead() {
    try {
      const { supabase, userId } = await getNotificationUserId()
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      if (error) throw error
      await refetchNotifications()
    } catch (error) {
      console.error('Mark all notifications read failed:', error)
      setNotificationError('Could not mark notifications as read.')
    }
  }

  async function markNotificationRead(notification: UserNotification) {
    if (notification.is_read) return
    try {
      const { supabase, userId } = await getNotificationUserId()
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id)
        .eq('user_id', userId)
      if (error) throw error
      await refetchNotifications()
    } catch (error) {
      console.error('Mark notification read failed:', error)
      setNotificationError('Could not mark this notification as read.')
    }
  }

  useEffect(() => {
    let active = true
    setProfileRole(null)

    async function loadProfileRole() {
      if (!account) {
        return
      }

      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user || user.id !== account.id) {
          if (active) setProfileRole(null)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profileError) throw profileError
        if (active) setProfileRole(profile.role)
      } catch (error) {
        console.error('Navigation profile role lookup failed:', error)
        if (active) setProfileRole(null)
      }
    }

    void loadProfileRole()
    return () => {
      active = false
    }
  }, [account?.id])

  function closeMobileMenu() {
    setIsMobileMenuOpen(false)
  }

  function renderNotificationBell() {
    if (!account) return null
    return (
      <div className="relative">
        <button
          type="button"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          aria-expanded={isNotificationsOpen}
          aria-haspopup="dialog"
          onClick={() => setIsNotificationsOpen((open) => !open)}
          className="relative flex size-10 items-center justify-center rounded-lg border border-white/[0.09] bg-white/[0.035] text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount}
            </span>
          )}
        </button>
        {isNotificationsOpen && (
          <section
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 top-12 z-50 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-white/10 bg-[#111a27] shadow-2xl shadow-black/40"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-100">Notifications</h2>
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                disabled={unreadCount === 0}
                className="text-xs font-medium text-teal-200 hover:text-teal-100 disabled:cursor-default disabled:opacity-50"
              >
                Mark all as read
              </button>
            </div>
            {notificationError && (
              <p role="alert" className="border-b border-red-400/10 px-4 py-2 text-xs text-red-300">
                {notificationError}
              </p>
            )}
            <ul className="max-h-[min(65vh,420px)] overflow-y-auto">
              {notifications.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  No notifications yet.
                </li>
              ) : (
                notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => void markNotificationRead(notification)}
                      className="flex w-full items-start gap-3 border-b border-white/[0.05] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.035]"
                    >
                      <span className="mt-1.5 flex size-2 shrink-0 items-center justify-center">
                        {!notification.is_read && (
                          <span className="size-2 rounded-full bg-emerald-400" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-100">
                          {notification.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">
                          {notification.message}
                        </span>
                        <time
                          dateTime={notification.created_at}
                          className="mt-1.5 block text-[10px] text-slate-500"
                        >
                          {formatNotificationTime(notification.created_at)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        )}
      </div>
    )
  }

  function renderNavigationLinks(mobile = false) {
    const navigationLinks =
      profileRole === 'operator' || profileRole === 'admin'
        ? [...NAV_LINKS, { label: 'Admin Dashboard', href: '/admin' }]
        : NAV_LINKS

    return navigationLinks.map(({ label, href }) => {
      const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
      return (
        <Link
          key={href}
          href={href}
          onClick={mobile ? closeMobileMenu : undefined}
          aria-current={active ? 'page' : undefined}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            active
              ? 'bg-white/[0.07] text-white'
              : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
          } ${mobile ? 'block w-full' : ''}`}
        >
          {label}
        </Link>
      )
    })
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090d16]/95 text-slate-100 shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="PrintKloud home">
            <span className="flex size-9 items-center justify-center rounded-xl border border-teal-200/20 bg-teal-200/10 text-teal-200">
              <Printer className="size-5" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
              Print<span className="text-teal-200">Kloud</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {renderNavigationLinks()}
          </nav>

          <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
            {renderNotificationBell()}
            {account && (
              <div
                aria-label={`Wallet balance ${account.balance === null ? 'unavailable' : formatBDT(account.balance)}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3"
              >
                <Wallet className="size-4 text-teal-200" aria-hidden="true" />
                <span className="font-mono text-sm font-semibold tabular-nums text-slate-100">
                  {account.balance === null ? '—' : formatBDT(account.balance)}
                </span>
              </div>
            )}
            {account ? (
              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  onClick={() => setIsProfileMenuOpen((open) => !open)}
                  className="inline-flex h-10 max-w-48 items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-2.5 text-sm text-slate-200 transition-colors hover:bg-white/[0.07]"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-teal-200/10 text-teal-200">
                    <UserRound className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="max-w-24 truncate">{account.name.split(' ')[0]}</span>
                  <ChevronDown className="size-3.5 text-slate-500" aria-hidden="true" />
                </button>
                {isProfileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-white/10 bg-[#111a27] p-1.5 shadow-2xl shadow-black/40"
                  >
                    <div className="border-b border-white/[0.07] px-3 py-2.5">
                      <p className="truncate text-sm font-medium text-slate-100">{account.name}</p>
                      <p className="truncate text-xs text-slate-500">{account.email}</p>
                    </div>
                    <Link
                      href="/account"
                      role="menuitem"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <UserRound className="size-4" aria-hidden="true" />
                      My account
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void createSupabaseBrowserClient().auth.signOut()
                        setIsProfileMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsAccountDialogOpen(true)}
                className="h-10 gap-2 border-white/10 bg-white/[0.035] text-slate-200 hover:bg-white/[0.07] hover:text-white"
              >
                <LogIn className="size-4" aria-hidden="true" />
                Sign in
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {renderNotificationBell()}
            {account && (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.035] px-2.5">
                <Wallet className="size-3.5 text-teal-200" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold tabular-nums text-slate-100">
                  {account.balance === null ? '—' : formatBDT(account.balance)}
                </span>
              </span>
            )}
            <button
              type="button"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-200 hover:bg-white/[0.07]"
            >
              {isMobileMenuOpen ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Menu className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div id="mobile-navigation" className="border-t border-white/[0.07] bg-[#0c121d] px-4 pb-4 pt-3 sm:px-6 lg:hidden">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
              {renderNavigationLinks(true)}
              </nav>
              <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.07] pt-3">
                {account ? (
                <button
                  type="button"
                  onClick={() => {
                    void createSupabaseBrowserClient().auth.signOut()
                    closeMobileMenu()
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.09] text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out · {account.name}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu()
                    setIsAccountDialogOpen(true)
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.09] text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
                >
                  <LogIn className="size-4" aria-hidden="true" />
                  Sign in / Create account
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <AccountDialog
        open={isAccountDialogOpen}
        onOpenChange={setIsAccountDialogOpen}
        account={account}
      />
    </>
  )
}
