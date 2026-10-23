'use client'

import { useState } from 'react'
import { Check, Loader2, LogOut } from 'lucide-react'
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
import { useSupabaseAccount, type SupabaseAccount } from '@/lib/supabase/use-account'
import { FemaleAvatarSvg, MaleAvatarSvg, UserAvatar } from '@/components/UserAvatar'

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
  const { refresh } = useSupabaseAccount()
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)
  const currentAvatar = account.avatarType || 'male'

  async function handleAvatarSelect(type: 'male' | 'female') {
    if (type === currentAvatar || isUpdatingAvatar) return
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

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Your account</DialogTitle>
        <DialogDescription>Manage your PrintKloud profile &amp; wallet.</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3.5">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-border">
          <UserAvatar type={currentAvatar} className="size-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{account.name}</p>
          <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          {account.phone && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{account.phone}</p>
          )}
        </div>
      </div>

      {/* Avatar Switcher */}
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="mb-2.5 text-xs font-medium text-muted-foreground">Select Profile Avatar</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={isUpdatingAvatar}
            onClick={() => void handleAvatarSelect('male')}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border p-2 text-left text-xs font-medium transition-colors',
              currentAvatar === 'male'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background/50 text-muted-foreground hover:text-foreground',
            )}
          >
            <div className="size-8 shrink-0 overflow-hidden rounded-md">
              <MaleAvatarSvg className="size-full" />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between">
              <span>Male</span>
              {currentAvatar === 'male' && <Check className="size-3.5" />}
            </div>
          </button>

          <button
            type="button"
            disabled={isUpdatingAvatar}
            onClick={() => void handleAvatarSelect('female')}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border p-2 text-left text-xs font-medium transition-colors',
              currentAvatar === 'female'
                ? 'border-pink-500/50 bg-pink-500/10 text-pink-400'
                : 'border-border bg-background/50 text-muted-foreground hover:text-foreground',
            )}
          >
            <div className="size-8 shrink-0 overflow-hidden rounded-md">
              <FemaleAvatarSvg className="size-full" />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between">
              <span>Female</span>
              {currentAvatar === 'female' && <Check className="size-3.5" />}
            </div>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Wallet balance
        </p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground">
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

type Mode = 'signin' | 'signup' | 'forgot'

function AuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [avatarChoice, setAvatarChoice] = useState<'male' | 'female'>('male')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'forgot') {
      if (!email.trim()) return setError('Please enter your email address.')
      setIsPending(true)
      try {
        const supabase = createSupabaseBrowserClient()
        const redirectUrl = `${window.location.origin}/reset-password`
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl,
        })
        if (resetError) throw resetError
        setNotice('Password reset email sent! Please check your inbox.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send reset link.')
      } finally {
        setIsPending(false)
      }
      return
    }

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
              avatar_type: avatarChoice,
            },
          },
        })
        if (authError) throw authError
        if (!data.session) {
          setNotice('Account created! Please check your email to verify before signing in.')
        } else {
          // If session is created, ensure profile is initialized
          if (data.user?.id) {
            try {
              await supabase
                .from('profiles')
                .update({ avatar_type: avatarChoice })
                .eq('id', data.user.id)
            } catch {
              // Non-blocking profile update failure
            }
          }
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
        <DialogTitle>
          {mode === 'signin'
            ? 'Sign in to PrintKloud'
            : mode === 'signup'
              ? 'Create your account'
              : 'Reset your password'}
        </DialogTitle>
        <DialogDescription>
          {mode === 'signin'
            ? 'Access your wallet and print jobs.'
            : mode === 'signup'
              ? 'Your wallet balance stays safe in your account.'
              : 'Enter your email to receive a password recovery link.'}
        </DialogDescription>
      </DialogHeader>

      {mode !== 'forgot' && (
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
                setNotice(null)
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
      )}

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
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Choose avatar</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAvatarChoice('male')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2 text-xs font-medium transition-colors',
                    avatarChoice === 'male'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background/50 text-muted-foreground',
                  )}
                >
                  <div className="size-6 overflow-hidden rounded-md">
                    <MaleAvatarSvg className="size-full" />
                  </div>
                  <span>Male</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarChoice('female')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2 text-xs font-medium transition-colors',
                    avatarChoice === 'female'
                      ? 'border-pink-500/50 bg-pink-500/10 text-pink-400'
                      : 'border-border bg-background/50 text-muted-foreground',
                  )}
                >
                  <div className="size-6 overflow-hidden rounded-md">
                    <FemaleAvatarSvg className="size-full" />
                  </div>
                  <span>Female</span>
                </button>
              </div>
            </div>
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

        {mode !== 'forgot' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="acc-password" className="text-sm font-medium">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setError(null)
                    setNotice(null)
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
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
          </div>
        )}
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
        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send Reset Link'}
      </Button>

      {mode === 'forgot' && (
        <button
          type="button"
          onClick={() => {
            setMode('signin')
            setError(null)
            setNotice(null)
          }}
          className="text-center text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to sign in
        </button>
      )}
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
