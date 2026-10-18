import Link from 'next/link'
import { Printer, Wallet, Plus, LogIn, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/print'
import type { Account } from '@/lib/account-store'

interface DashboardHeaderProps {
  account: Account | null
  onAccountClick: () => void
  onTopUp: () => void
}

export function DashboardHeader({ account, onAccountClick, onTopUp }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label="PrintKloud home">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Printer className="size-5" aria-hidden="true" />
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-lg font-semibold tracking-tight">PrintKloud</span>
            <span className="text-[11px] text-muted-foreground">Print & deliver near KUET</span>
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          {account && (
            <Link
              href="/account"
              className="inline-flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
            >
              <UserRound className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">My account</span>
            </Link>
          )}
          <button
            type="button"
            onClick={onAccountClick}
            aria-label={account ? `Open account for ${account.name}` : 'Sign in or create account'}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {account ? (
              <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <LogIn className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="flex flex-col leading-tight" aria-live="polite">
              <span className="max-w-28 truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {account ? account.name.split(' ')[0] : 'Wallet'}
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {account ? formatBDT(account.balance) : 'Sign in'}
              </span>
            </span>
          </button>

          <Button
            onClick={onTopUp}
            className="h-10 gap-2 bg-bkash px-3 text-bkash-foreground hover:bg-bkash/90 sm:px-4"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Top Up Wallet via bKash</span>
            <span className="md:hidden">Top Up</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
