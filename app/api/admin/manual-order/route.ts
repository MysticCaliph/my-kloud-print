import { randomBytes, randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import { calculateManualOrderCostPoisha, type ManualPrintSide } from '@/lib/manual-order'
import { isCustomDeliveryOption } from '@/lib/print'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_DATABASE_INTEGER = 2_147_483_647

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function isConfirmedRpcSuccess(value: unknown) {
  return (
    value === true ||
    (typeof value === 'object' &&
      value !== null &&
      (('success' in value && value.success === true) ||
        ('deducted' in value && value.deducted === true)))
  )
}

async function refundWalletDeduction(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  amountPoisha: number,
) {
  try {
    const { data, error } = await supabaseAdmin.rpc('atomic_wallet_topup', {
      p_user_id: userId,
      p_amount_poisha: amountPoisha,
    })
    if (error) {
      console.error('Manual print order wallet refund failed:', error)
      return false
    }
    if (!isConfirmedRpcSuccess(data)) {
      console.error('Manual print order wallet refund was not confirmed:', data)
      return false
    }
    return true
  } catch (error) {
    console.error('Manual print order wallet refund failed:', error)
    return false
  }
}

export async function POST(request: Request) {
  let supabase
  try {
    supabase = await createSupabaseServerClient()
  } catch (error) {
    console.error('Manual print order authentication configuration error:', error)
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
    console.error('Manual print order authentication failed:', error)
    return jsonError('Could not verify the signed-in user.', 503)
  }

  let supabaseAdmin
  try {
    supabaseAdmin = createSupabaseAdminClient()
  } catch (error) {
    console.error('Manual print order service configuration error:', error)
    return jsonError('Manual print orders are not configured on the server.', 503)
  }

  const { data: operator, error: operatorError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (operatorError) {
    console.error('Manual print order operator lookup failed:', operatorError)
    return jsonError('Could not verify operator access.', 503)
  }
  if (operator?.role !== 'operator' && operator?.role !== 'admin') {
    return jsonError('Operator access is required.', 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Request must contain valid JSON.', 400)
  }
  if (typeof body !== 'object' || body === null) {
    return jsonError('A manual print order is required.', 400)
  }

  const input = body as Record<string, unknown>
  const userId = input.userId
  const paperSize = input.paperSize
  const printSide: ManualPrintSide = input.printSide === 'DUPLEX' ? 'DUPLEX' : 'SINGLE'
  const totalPages = input.totalPages
  const copies = input.copies
  const deliveryOption = input.deliveryOption
  const deliveryAddress =
    typeof input.deliveryAddress === 'string' ? input.deliveryAddress.trim() : ''
  const deliveryNotes =
    typeof input.deliveryNotes === 'string' ? input.deliveryNotes.trim() : ''
  const customerName = input.customerName
  const customerPhone = input.customerPhone
  const originalFilename = input.originalFilename
  const deductFromWallet = input.deductFromWallet

  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
    return jsonError('Select a valid customer account.', 400)
  }
  if (paperSize !== 'A4' && paperSize !== 'LEGAL') {
    return jsonError('Paper size must be "A4" or "LEGAL".', 400)
  }
  if (
    typeof totalPages !== 'number' ||
    !Number.isSafeInteger(totalPages) ||
    totalPages < 1 ||
    totalPages > MAX_DATABASE_INTEGER
  ) {
    return jsonError('Page count must be a positive whole number.', 400)
  }
  if (
    typeof copies !== 'number' ||
    !Number.isSafeInteger(copies) ||
    copies < 1 ||
    copies > MAX_DATABASE_INTEGER
  ) {
    return jsonError('Copy count must be a positive whole number.', 400)
  }
  if (
    typeof deliveryOption !== 'string' ||
    !deliveryOption.trim() ||
    deliveryOption.length > 200
  ) {
    return jsonError('Select a delivery option of 200 characters or fewer.', 400)
  }
  if (isCustomDeliveryOption(deliveryOption) && !deliveryAddress) {
    return jsonError('Enter a custom delivery location / place name.', 400)
  }
  if (
    customerName !== undefined &&
    (typeof customerName !== 'string' || customerName.length > 200)
  ) {
    return jsonError('Customer name must be 200 characters or fewer.', 400)
  }
  if (
    customerPhone !== undefined &&
    (typeof customerPhone !== 'string' || customerPhone.length > 40)
  ) {
    return jsonError('Customer phone must be 40 characters or fewer.', 400)
  }
  if (
    originalFilename !== undefined &&
    (typeof originalFilename !== 'string' || originalFilename.length > 200)
  ) {
    return jsonError('Job title must be 200 characters or fewer.', 400)
  }
  if (typeof deductFromWallet !== 'boolean') {
    return jsonError('Choose whether to deduct the price from the user wallet.', 400)
  }

  const totalCostPoisha = calculateManualOrderCostPoisha(
    paperSize,
    printSide,
    totalPages,
    copies,
    deliveryOption,
  )
  if (!Number.isSafeInteger(totalCostPoisha) || totalCostPoisha <= 0) {
    return jsonError('The calculated order total is outside the supported range.', 400)
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone_number')
    .eq('id', userId)
    .maybeSingle()
  if (customerError) {
    console.error('Manual print order customer lookup failed:', customerError)
    return jsonError('Could not load the selected customer.', 500)
  }
  if (!customer) return jsonError('The selected customer account was not found.', 404)

  if (deductFromWallet) {
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance_poisha')
      .eq('user_id', userId)
      .maybeSingle()
    if (walletError) {
      console.error('Manual print order wallet balance lookup failed:', walletError)
      return jsonError('Could not verify the user wallet balance.', 503)
    }
    const balance = wallet?.balance_poisha ?? 0
    if (balance < totalCostPoisha) {
      return jsonError('The customer does not have enough balance in their wallet.', 400)
    }

    try {
      const { data, error } = await supabaseAdmin.rpc('atomic_deduct_print_cost', {
        p_user_id: userId,
        p_amount_poisha: totalCostPoisha,
      })
      const errorMessage = error?.message || 'Could not deduct the cost from the customer wallet.'
      if (error) return jsonError(errorMessage, 500)
      if (!isConfirmedRpcSuccess(data)) {
        console.error('Wallet deduction RPC returned an unconfirmed result:', data)
        return jsonError(errorMessage, 500)
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message || 'Unknown error'
          : typeof error === 'object' &&
              error !== null &&
              'message' in error &&
              typeof error.message === 'string'
            ? error.message || 'Unknown error'
            : String(error)
      console.error(`Manual print order wallet deduction failed: ${message}`, error)
      return jsonError(message, 500)
    }
  }

  const digits = randomInt(1000, 10000)
  const suffix = randomBytes(3).toString('hex').toUpperCase()
  const token = `#PRT-${digits}-${suffix}`
  let jobId: string | null = null
  let insertErrorMessage: string | null = null
  try {
    const { data: job, error: insertError } = await supabaseAdmin
      .from('print_jobs')
      .insert({
        token,
        user_id: userId,
        customer_name:
          (typeof customerName === 'string' && customerName.trim()) ||
          customer.full_name?.trim() ||
          'Customer',
        customer_phone:
          (typeof customerPhone === 'string' && customerPhone.trim()) ||
          customer.phone_number?.trim() ||
          '',
        original_filename: originalFilename?.trim() || 'Manual Admin Job (No PDF)',
        file_storage_path: null,
        paper_size: paperSize,
        print_side: printSide,
        upload_method: 'DIRECT',
        color_mode: 'bw',
        total_pages: totalPages,
        copies,
        total_cost_poisha: totalCostPoisha,
        status: 'queued',
        delivery_option: deliveryOption.trim(),
        delivery_address: deliveryAddress || null,
        delivery_notes: deliveryNotes || null,
        is_manual: true,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Print Jobs Insert Error:', insertError)
      insertErrorMessage = insertError.message
    } else {
      jobId = job?.id ?? null
    }
  } catch (insertError) {
    console.error('Print Jobs Insert Error:', insertError)
    insertErrorMessage =
      insertError instanceof Error ? insertError.message : 'Could not create the print job.'
  }

  if (!jobId) {
    if (deductFromWallet) {
      const refunded = await refundWalletDeduction(supabaseAdmin, userId, totalCostPoisha)
      if (!refunded) {
        console.error(
          `Manual print order creation failed after wallet deduction: user ${userId}, amount ${totalCostPoisha}`,
        )
      }
    }
    return jsonError(
      insertErrorMessage || 'Could not save the manual print job.',
      500,
    )
  }

  const tokenCode = token.replace(/^#/, '')
  const { error: tokenInsertError } = await supabaseAdmin.from('print_tokens').insert({
    token_code: tokenCode,
    token: tokenCode,
    print_job_id: jobId,
  })
  if (tokenInsertError) {
    console.error('Manual print order token link error:', tokenInsertError)
  }

  return NextResponse.json({
    success: true,
    job: {
      id: jobId,
      token,
      totalCostPoisha,
    },
  })
}
