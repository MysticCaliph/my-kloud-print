import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  let supabase
  try {
    supabase = await createSupabaseServerClient()
  } catch (error) {
    console.error('Admin wallet top-up authentication configuration error:', error)
    return jsonError('Authentication is not configured on the server.', 503)
  }

  let user
  try {
    const {
      data: { user: authenticatedUser },
      error,
    } = await supabase.auth.getUser()
    if (error) throw error
    if (!authenticatedUser) return jsonError('User not authenticated', 401)
    user = authenticatedUser
  } catch (error) {
    console.error('Admin wallet top-up authentication failed:', error)
    return jsonError('Could not verify the signed-in user.', 503)
  }

  let supabaseAdmin
  try {
    supabaseAdmin = createSupabaseAdminClient()
  } catch (error) {
    console.error('Admin wallet top-up configuration error:', error)
    return jsonError('Wallet top-up service is not configured on the server.', 503)
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) {
    console.error('Admin wallet top-up operator lookup failed:', profileError)
    return jsonError('Could not verify operator access.', 503)
  }
  if (profile?.role !== 'operator') {
    return jsonError('Unauthorized: Operator access required', 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Request must contain valid JSON.', 400)
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    !('targetUserId' in body) ||
    typeof body.targetUserId !== 'string' ||
    !body.targetUserId.trim() ||
    !('amountBdt' in body) ||
    typeof body.amountBdt !== 'number' ||
    !Number.isFinite(body.amountBdt) ||
    body.amountBdt <= 0
  ) {
    return jsonError('A target user ID and positive amountBdt are required.', 400)
  }

  const targetUserId = body.targetUserId.trim()
  const amountBdt = body.amountBdt
  const amountPoisha = Math.round(amountBdt * 100)
  if (!Number.isSafeInteger(amountPoisha) || amountPoisha <= 0) {
    return jsonError('amountBdt must convert to a positive integer amount in poisha.', 400)
  }

  const { data: success, error } = await supabaseAdmin.rpc('atomic_wallet_topup', {
    p_user_id: targetUserId,
    p_amount_poisha: amountPoisha,
  })
  if (error) {
    console.error('Admin wallet top-up RPC failed:', error)
    return jsonError(error.message, 500)
  }

  const topUpSucceeded =
    success === true ||
    (typeof success === 'object' &&
      success !== null &&
      'success' in success &&
      success.success === true)
  if (!topUpSucceeded) {
    return jsonError('Wallet top-up was not completed.', 500)
  }

  return NextResponse.json({
    success: true,
    message: `Successfully added ৳${(amountPoisha / 100).toFixed(2)} credit`,
  })
}
