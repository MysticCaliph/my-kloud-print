import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  try {
    supabase = await createSupabaseServerClient()
  } catch (error) {
    console.error('bKash payment configuration error:', error)
    return NextResponse.json(
      { success: false, error: 'Payment service is not configured.' },
      { status: 503 },
    )
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json(
      { success: false, error: 'Sign in before starting a wallet top-up.' },
      { status: 401 },
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: 'bKash payments are not configured yet. Your wallet has not been charged.',
    },
    { status: 503 },
  )
}
