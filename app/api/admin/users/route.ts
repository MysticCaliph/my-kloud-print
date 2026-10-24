import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  let supabase
  try {
    supabase = await createSupabaseServerClient()
  } catch (error) {
    console.error('Admin user search authentication configuration error:', error)
    return jsonError('Authentication is not configured on the server.', 503)
  }

  let user
  try {
    const {
      data: { user: authenticatedUser },
      error,
    } = await supabase.auth.getUser()
    if (error) throw error
    if (!authenticatedUser) return jsonError('User not authenticated.', 401)
    user = authenticatedUser
  } catch (error) {
    console.error('Admin user search authentication failed:', error)
    return jsonError('Could not verify the signed-in user.', 503)
  }

  let supabaseAdmin
  try {
    supabaseAdmin = createSupabaseAdminClient()
  } catch (error) {
    console.error('Admin user search configuration error:', error)
    return jsonError('User search is not configured on the server.', 503)
  }

  const { data: operator, error: operatorError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (operatorError) {
    console.error('Admin user search operator lookup failed:', operatorError)
    return jsonError('Could not verify operator access.', 503)
  }
  if (operator?.role !== 'operator' && operator?.role !== 'admin') {
    return jsonError('Unauthorized: Operator access required', 403)
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone_number, email, wallets(balance_poisha)')
    .order('created_at', { ascending: false })
  if (profilesError) {
    console.error('Admin user list query failed:', profilesError)
    return jsonError(profilesError.message, 500)
  }

  return NextResponse.json({
    users: profiles.map((profile) => ({
      id: profile.id,
      name: profile.full_name || 'Customer',
      phone: profile.phone_number || '',
      email: profile.email || '',
      wallets: profile.wallets,
    })),
  })
}
