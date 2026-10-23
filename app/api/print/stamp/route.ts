import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createOfficialReceiptPdfBytes } from '@/lib/pdf-stamper'

export const runtime = 'nodejs'

let cachedLogoBytes: Uint8Array | null = null

async function getProjectLogoBytes(): Promise<Uint8Array | undefined> {
  if (cachedLogoBytes) return cachedLogoBytes
  try {
    const buf = await readFile(path.join(process.cwd(), 'public', 'logo.jpg'))
    if (buf.byteLength > 0) {
      cachedLogoBytes = new Uint8Array(buf)
      return cachedLogoBytes
    }
  } catch {
    // Fallback to vector icon if file is not available
  }
  return undefined
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return jsonError('A print job ID is required.', 400)

  let supabase
  try {
    supabase = await createSupabaseServerClient()
  } catch (error) {
    console.error('Print stamp authentication configuration error:', error)
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
    console.error('Print stamp authentication failed:', error)
    return jsonError('Could not verify the signed-in user.', 503)
  }

  let supabaseAdmin
  try {
    supabaseAdmin = createSupabaseAdminClient()
  } catch (error) {
    console.error('Print stamp administrative configuration error:', error)
    return jsonError('Print stamp service is not configured on the server.', 503)
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) {
    console.error('Print stamp operator role lookup failed:', profileError)
    return jsonError('Could not verify operator access.', 503)
  }
  if (profile?.role !== 'operator' && profile?.role !== 'admin') {
    return jsonError('Operator access is required.', 403)
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('print_jobs')
    .select(
      'token, user_id, customer_name, customer_phone, delivery_option, delivery_address, delivery_notes, total_pages, paper_size, color_mode, print_side, upload_method, copies, total_cost_poisha, created_at, original_filename',
    )
    .eq('id', id)
    .maybeSingle()
  if (jobError) {
    console.error('Print stamp job lookup failed:', jobError)
    return jsonError('Could not load the print job.', 500)
  }
  if (!job) return jsonError('Print job not found.', 404)

  let resolvedCustomerName =
    typeof job.customer_name === 'string' && job.customer_name.trim()
      ? job.customer_name.trim()
      : ''

  if (!resolvedCustomerName && job.user_id) {
    const { data: customerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', job.user_id)
      .maybeSingle()
    if (customerProfile?.full_name?.trim()) {
      resolvedCustomerName = customerProfile.full_name.trim()
    }
  }
  if (!resolvedCustomerName) {
    resolvedCustomerName = 'Guest / Walk-in'
  }

  try {
    const logoBytes = await getProjectLogoBytes()
    const pdfBytes = await createOfficialReceiptPdfBytes({
      order_token: job.token,
      customer_name: resolvedCustomerName,
      customer_phone: job.customer_phone,
      upload_method: job.upload_method || 'DIRECT',
      paper_size: job.paper_size,
      print_side: job.print_side || 'SINGLE',
      page_count: job.total_pages,
      total_pages: job.total_pages,
      copies: job.copies,
      total_cost_poisha: job.total_cost_poisha,
      delivery_option: job.delivery_option,
      delivery_address: job.delivery_address,
      delivery_notes: job.delivery_notes,
      created_at: job.created_at,
      job_title: job.original_filename,
      logo_bytes: logoBytes,
    })

    const filenameToken = String(job.token).replace(/[^A-Za-z0-9_-]/g, '_')
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Receipt-${filenameToken}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Print stamp PDF generation failed:', error)
    return jsonError(
      error instanceof Error ? error.message : 'Could not generate the print receipt.',
      500,
    )
  }
}
