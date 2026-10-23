'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound, Loader2, Lock } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createSupabaseBrowserClient()

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (active) {
          setHasValidSession(Boolean(session))
          setIsCheckingSession(false)
        }
      } catch {
        if (active) {
          setHasValidSession(false)
          setIsCheckingSession(false)
        }
      }
    }

    void checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        if (event === 'PASSWORD_RECOVERY' || session) {
          setHasValidSession(true)
          setIsCheckingSession(false)
        }
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        router.push('/')
      }, 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <Navbar />
      <main className="mx-auto flex min-h-[75vh] max-w-md items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-white/[0.08] bg-[#101722] p-6 shadow-2xl shadow-black/40 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-200">
              <KeyRound className="size-6" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Set New Password
            </h1>
            <p className="mt-1.5 text-xs text-slate-400">
              Enter your new password below to regain access to your PrintKloud account.
            </p>
          </div>

          {isCheckingSession ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-slate-400">
              <Loader2 className="mb-2 size-6 animate-spin text-teal-200" />
              Verifying recovery link…
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="size-12 text-teal-200" />
              <p className="text-base font-semibold text-white">Password Updated!</p>
              <p className="text-xs text-slate-400">
                Your password has been changed successfully. Redirecting you to the home page…
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className="text-xs font-medium text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" />
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="h-10 pl-9 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600 focus-visible:border-teal-300/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className="text-xs font-medium text-slate-300">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" />
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="h-10 pl-9 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600 focus-visible:border-teal-300/50"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-2 h-10 w-full bg-teal-300 font-semibold text-slate-950 hover:bg-teal-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Updating Password…
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

