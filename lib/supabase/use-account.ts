'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from './client'

export interface SupabaseAccount {
  id: string
  name: string
  email: string
  phone: string
  balance: number | null
  createdAt: string
  avatarType: 'male' | 'female'
}

interface AccountState {
  account: SupabaseAccount | null
  isLoading: boolean
  error: string | null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Could not load account details.'
}

export function useSupabaseAccount() {
  const [state, setState] = useState<AccountState>({
    account: null,
    isLoading: true,
    error: null,
  })

  const loadUser = useCallback(async (user: User | null) => {
    if (!user) {
      setState({ account: null, isLoading: false, error: null })
      return
    }

    setState((current) => ({ ...current, isLoading: true, error: null }))
    try {
      const supabase = createSupabaseBrowserClient()
      const [{ data: profile, error: profileError }, { data: wallet, error: walletError }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, phone_number, avatar_type')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('wallets')
            .select('balance_poisha')
            .eq('user_id', user.id)
            .maybeSingle(),
        ])

      if (profileError) throw profileError
      if (walletError) throw walletError

      const metadataName = user.user_metadata?.full_name
      const metadataPhone = user.user_metadata?.phone_number
      const metadataAvatar = user.user_metadata?.avatar_type
      const walletBalancePoisha = Number(wallet?.balance_poisha)
      const avatarType: 'male' | 'female' =
        profile?.avatar_type === 'female' || metadataAvatar === 'female' ? 'female' : 'male'

      setState({
        account: {
          id: user.id,
          name:
            profile?.full_name ||
            (typeof metadataName === 'string' ? metadataName : '') ||
            user.email ||
            'PrintKloud user',
          email: user.email ?? '',
          phone:
            profile?.phone_number ??
            (typeof metadataPhone === 'string' ? metadataPhone : ''),
          balance:
            wallet?.balance_poisha != null && Number.isFinite(walletBalancePoisha)
              ? walletBalancePoisha / 100
              : null,
          createdAt: user.created_at,
          avatarType,
        },
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setState({ account: null, isLoading: false, error: errorMessage(error) })
    }
  }, [])

  useEffect(() => {
    let active = true
    const supabase = createSupabaseBrowserClient()

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      if (!data.user) {
        setState({ account: null, isLoading: false, error: null })
        return
      }
      if (error) {
        setState({ account: null, isLoading: false, error: error.message })
        return
      }
      void loadUser(data.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void loadUser(session?.user ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadUser])

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.getUser()
    if (!data.user) {
      setState({ account: null, isLoading: false, error: null })
      return
    }
    if (error) {
      setState({ account: null, isLoading: false, error: error.message })
      return
    }
    await loadUser(data.user)
  }, [loadUser])

  return { ...state, refresh }
}
