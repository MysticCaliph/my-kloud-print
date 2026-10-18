'use client'

import { useState } from 'react'
import { Loader2, LogOut, UserRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatBDT } from '@/lib/print'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { SupabaseAccount } from '@/lib/supabase/use-account'

interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: SupabaseAccount | null
}

export function AccountDialog({ open, onOpenChange, account }: AccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open &&
          (account ? (
            <AccountOverview account={account} onClose={() => onOpenChange(false)} />
          ) : (
            <AuthForm onAuthenticated={() => onOpenChange(false)} />
          ))}
      </DialogContent>
    </Dialog>
  )
}

function AccountOverview({
  account,
  onClose,
}: {
  account: SupabaseAccount
  onClose: () => void
}) {
  const initials = account.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Your account</DialogTitle>
        <DialogDescription>Manage your PrintKloud wallet.</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary">
          {initials || <UserRound className="size-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{account.name}</p>
          <p className="truncate text-sm text-muted-foreground">{account.email}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Wallet balance
        </p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
          {account.balance === null ? 'Unavailable' : formatBDT(account.balance)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="h-11 gap-2"
          onClick={() => {
            void createSupabaseBrowserClient().auth.signOut()
            onClose()
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </div>
  )
}

type Mode = 'signin' | 'signup'

function AuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (mode === 'signup' && name.trim().length < 2) return setError('Please enter your name.')
    if (mode === 'signup' && phone.trim().length < 7) return setError('Please enter a valid phone number.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setIsPending(true)
    try {
      const supabase = createSupabaseBrowserClient()
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name.trim(),
              phone_number: phone.trim(),
            },
          },
        })
        if (authError) throw authError
        if (!data.session) {
          setNotice('Account created. Check your email to confirm your account before signing in.')
        } else {
          onAuthenticated()
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        onAuthenticated()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{mode === 'signin' ? 'Sign in to PrintKloud' : 'Create your account'}</DialogTitle>
        <DialogDescription>
          {mode === 'signin'
            ? 'Access your wallet and print jobs.'
            : 'Your wallet balance stays safe in your account.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={cn(
              'h-9 rounded-md text-sm font-medium transition-colors',
              mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {mode === 'signup' && (
          <>
            <Field label="Full name" htmlFor="acc-name">
              <Input
                id="acc-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11"
              />
            </Field>
            <Field label="Phone number" htmlFor="acc-phone">
              <Input
                id="acc-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="h-11"
              />
            </Field>
          </>
        )}
        <Field label="Email" htmlFor="acc-email">
          <Input
            id="acc-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </Field>
        <Field label="Password" htmlFor="acc-password">
          <Input
            id="acc-password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-11"
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="h-11 gap-2 font-semibold">
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </Button>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
