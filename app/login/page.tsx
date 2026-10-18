'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AccountDialog } from '@/components/dashboard/account-dialog'
import { useSupabaseAccount } from '@/lib/supabase/use-account'

export default function LoginPage() {
  const router = useRouter()
  const { account, isLoading } = useSupabaseAccount()
  const [isDialogOpen, setIsDialogOpen] = useState(true)

  useEffect(() => {
    if (account) router.replace('/')
  }, [account, router])

  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-white/[0.08] bg-[#101722] px-6 py-10 text-center">
          <h1 className="text-xl font-semibold text-white">Sign in to PrintKloud</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Sign in or create an account to continue.
          </p>
          {isLoading && (
            <p className="mt-5 text-sm text-slate-500">Checking your session…</p>
          )}
          {!isLoading && !account && (
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-teal-300 px-5 text-sm font-semibold text-slate-950 hover:bg-teal-200"
            >
              Sign in / Create account
            </button>
          )}
        </div>
      </main>
      <AccountDialog
        open={isDialogOpen && !isLoading && !account}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) router.replace('/')
        }}
        account={account}
      />
    </>
  )
}
