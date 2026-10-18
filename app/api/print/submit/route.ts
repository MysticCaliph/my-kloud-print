import { randomBytes, randomInt } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { calculatePrice, type PaperSize } from '@/lib/print'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_PAGES = 2000
const MAX_COPIES = 99

type PrintColorMode = 'bw' | 'color'

interface TelegramSendMediaGroupResponse {
  ok?: boolean
  description?: string
  result?: Array<{
    document?: {
      file_id?: string
    }
  }>
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function parsePositiveInteger(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function escapeMarkdown(value: string) {
  return value.replace(/([_*`\[\]])/g, '\\$1')
}

function makeOrderToken() {
  const digits = randomInt(1000, 10000)
  const suffix = randomBytes(3).toString('hex').toUpperCase()
  return `#PRT-${digits}-${suffix}`
}

function makeTelegramCaption({
  tokenCode,
  customerName,
  customerPhone,
  deliveryOption,
  selectedPageCount,
  pageRange,
  colorMode,
  paperSize,
  copies,
  totalCostBdt,
  deliveryNotes,
}: {
  tokenCode: string
  customerName: string
  customerPhone: string
  deliveryOption: string
  selectedPageCount: number
  pageRange: string
  colorMode: PrintColorMode
  paperSize: PaperSize
  copies: number
  totalCostBdt: string
  deliveryNotes: string
}) {
  return [
    `🖨️ *NEW PRINT ORDER* (#${escapeMarkdown(tokenCode)})`,
    `👤 *Customer Name:* ${escapeMarkdown(customerName)}`,
    `📱 *Phone:* ${escapeMarkdown(customerPhone)}`,
    `📍 *Delivery Preference:* ${escapeMarkdown(deliveryOption)}`,
    `📄 *Specs:* ${selectedPageCount} Pages (Range:${escapeMarkdown(pageRange)}) | ${paperSize} ${colorMode.toUpperCase()} | x${copies}`,
    `💵 *Paid Total:* ৳${escapeMarkdown(totalCostBdt)}`,
    `📝 *Notes:* ${escapeMarkdown(deliveryNotes || 'None')}`,
  ].join('\n')
}

async function createStampPdf({
  tokenCode,
  customerName,
  customerPhone,
  selectedPageCount,
  pageRange,
  colorMode,
  paperSize,
  copies,
  deliveryOption,
  totalCostBdt,
}: {
  tokenCode: string
  customerName: string
  customerPhone: string
  selectedPageCount: number
  pageRange: string
  colorMode: PrintColorMode
  paperSize: PaperSize
  copies: number
  deliveryOption: string
  totalCostBdt: number
}) {
  const qrPngBuffer = await QRCode.toBuffer(tokenCode, { margin: 1, width: 80 })
  const stampPdfDoc = await PDFDocument.create()
  const page = stampPdfDoc.addPage([148.82, 210.47])
  const qrImage = await stampPdfDoc.embedPng(qrPngBuffer)
  const fontBold = await stampPdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await stampPdfDoc.embedFont(StandardFonts.Helvetica)
  const ink = rgb(0.08, 0.1, 0.13)
  const printable = (value: string, maxLength: number) =>
    value.replace(/[^\x20-\x7E]/g, '?').slice(0, maxLength)
  const shortDelivery =
    deliveryOption.length > 32 ? `${deliveryOption.slice(0, 29)}...` : deliveryOption

  page.drawRectangle({
    x: 0.5,
    y: 0.5,
    width: 147.82,
    height: 209.47,
    borderColor: rgb(0.55, 0.57, 0.6),
    borderWidth: 0.5,
  })
  page.drawText('PrintKloud', {
    x: 8,
    y: 192,
    size: 11,
    font: fontBold,
    color: ink,
  })
  page.drawText(`#${tokenCode}`, {
    x: 8,
    y: 177,
    size: 8,
    font: fontBold,
    color: ink,
    maxWidth: 132,
  })
  page.drawText(`Name: ${printable(customerName || 'Customer', 32)}`, {
    x: 8,
    y: 163,
    size: 6.5,
    font: fontRegular,
    color: ink,
    maxWidth: 132,
  })
  page.drawText(`Phone: ${printable(customerPhone, 32)}`, {
    x: 8,
    y: 151,
    size: 6.5,
    font: fontRegular,
    color: ink,
    maxWidth: 132,
  })
  page.drawText(
    `Specs: ${selectedPageCount}pg (${printable(pageRange, 24)}) ${paperSize} ${colorMode.toUpperCase()} x${copies}`,
    {
      x: 8,
      y: 138,
      size: 5.5,
      font: fontRegular,
      color: ink,
      maxWidth: 132,
    },
  )
  page.drawText(`Delivery: ${printable(shortDelivery, 36)}`, {
    x: 8,
    y: 125,
    size: 5.5,
    font: fontRegular,
    color: ink,
    maxWidth: 132,
  })
  page.drawText(`Total: Tk. ${totalCostBdt.toFixed(2)}`, {
    x: 8,
    y: 109,
    size: 7,
    font: fontBold,
    color: ink,
    maxWidth: 132,
  })
  page.drawImage(qrImage, {
    x: 96,
    y: 20,
    width: 44,
    height: 44,
  })

  return Buffer.from(await stampPdfDoc.save())
}

async function submitMediaGroupToTelegram({
  stampPdfBuffer,
  originalPdfBuffer,
  originalFilename,
  tokenCode,
  caption,
  botToken,
  chatId,
}: {
  stampPdfBuffer: Uint8Array
  originalPdfBuffer: Uint8Array
  originalFilename: string
  tokenCode: string
  caption: string
  botToken: string
  chatId: string
}) {
  const form = new FormData()
  form.set('chat_id', chatId)
  form.set(
    'stamp',
    new Blob([stampPdfBuffer as BlobPart], { type: 'application/pdf' }),
    `Stamp-${tokenCode}.pdf`,
  )
  form.set(
    'original',
    new Blob([originalPdfBuffer as BlobPart], { type: 'application/pdf' }),
    originalFilename,
  )
  form.set(
    'media',
    JSON.stringify([
      {
        type: 'document',
        media: 'attach://stamp',
        caption,
        parse_mode: 'Markdown',
      },
      {
        type: 'document',
        media: 'attach://original',
      },
    ]),
  )

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMediaGroup`,
    {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    },
  )

  let result: TelegramSendMediaGroupResponse
  try {
    result = (await response.json()) as TelegramSendMediaGroupResponse
  } catch {
    throw new Error(`Telegram returned an invalid response (HTTP ${response.status}).`)
  }

  const originalFileId = result.result?.[1]?.document?.file_id
  if (!response.ok || !result.ok || !originalFileId) {
    throw new Error(result.description ?? `Telegram media group upload failed (HTTP ${response.status}).`)
  }

  return originalFileId
}

export async function POST(request: Request) {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  try {
    supabase = await createSupabaseServerClient()
  } catch (error) {
    console.error('Print submission configuration error:', error)
    return jsonError('Print submission is not configured on the server.', 503)
  }

  let user: User
  try {
    const {
      data: { user: authenticatedUser },
    } = await supabase.auth.getUser()
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }
    user = authenticatedUser
  } catch (error) {
    console.error('Print submission authentication failed:', error)
    return jsonError('Could not verify the signed-in user.', 503)
  }

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
  const telegramChatId = process.env.TELEGRAM_CHAT_ID
  if (!telegramBotToken || !telegramChatId) {
    return jsonError('Telegram is not configured on the server.', 503)
  }

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>
  try {
    supabaseAdmin = createSupabaseAdminClient()
  } catch (error) {
    console.error('Print submission administrative configuration error:', error)
    return jsonError('Print submission is not configured on the server.', 503)
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) {
    console.error('Print submission customer profile lookup failed:', profileError)
    return jsonError('Could not load the customer profile.', 503)
  }
  const finalCustomerName = profile?.full_name?.trim() || 'Customer'

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError('Request must contain valid multipart form data.', 400)
  }

  const fileValue = form.get('file')
  const submittedUserId = form.get('userId')
  const phoneValue = form.get('customerPhone')
  const deliveryOptionValue = form.get('deliveryOption')
  const deliveryNotesValue = form.get('deliveryNotes')
  const pageRangeValue = form.get('pageRange') ?? form.get('selectedPageRange')
  const colorValue = form.get('colorMode')
  const paperSizeValue = form.get('paperSize')
  const selectedPagesValue = form.get('selectedPages')

  if (!(fileValue instanceof File)) {
    return jsonError('A PDF file is required.', 400)
  }
  if (typeof submittedUserId !== 'string' || submittedUserId !== user.id) {
    return jsonError('The submitted user does not match the signed-in account.', 403)
  }
  if (fileValue.size === 0 || fileValue.size > MAX_FILE_SIZE) {
    return jsonError('The PDF must be between 1 byte and 50 MB.', 400)
  }
  if (
    !fileValue.name.toLowerCase().endsWith('.pdf') &&
    fileValue.type !== 'application/pdf'
  ) {
    return jsonError('Only PDF files are accepted.', 400)
  }
  const originalFilename =
    fileValue.name.replace(/[\\/\r\n"]/g, '_').trim() || 'original.pdf'
  if (typeof phoneValue !== 'string' || phoneValue.trim().length < 7 || phoneValue.length > 40) {
    return jsonError('Enter a valid customer phone number.', 400)
  }
  if (
    deliveryOptionValue !== null &&
    (typeof deliveryOptionValue !== 'string' || deliveryOptionValue.length > 200)
  ) {
    return jsonError('Delivery preference must be 200 characters or fewer.', 400)
  }
  const finalDeliveryOption =
    typeof deliveryOptionValue === 'string' && deliveryOptionValue.trim()
      ? deliveryOptionValue.trim()
      : 'Not specified (Customer skipped)'
  if (
    deliveryNotesValue !== null &&
    (typeof deliveryNotesValue !== 'string' || deliveryNotesValue.length > 500)
  ) {
    return jsonError('Delivery notes must be 500 characters or fewer.', 400)
  }
  const deliveryNotes =
    typeof deliveryNotesValue === 'string' ? deliveryNotesValue.trim() : ''
  if (
    pageRangeValue !== null &&
    (typeof pageRangeValue !== 'string' || pageRangeValue.length > 200)
  ) {
    return jsonError('Page range must be 200 characters or fewer.', 400)
  }
  const finalPageRange =
    typeof pageRangeValue === 'string' && pageRangeValue.trim()
      ? pageRangeValue.trim()
      : 'All'
  if (colorValue !== 'bw' && colorValue !== 'color') {
    return jsonError('Color mode must be "bw" or "color".', 400)
  }
  if (paperSizeValue !== 'A4' && paperSizeValue !== 'Legal') {
    return jsonError('Paper size must be "A4" or "Legal".', 400)
  }

  const totalPages = parsePositiveInteger(form.get('totalPages'))
  let selectedPages: number[] | null = null
  if (totalPages && typeof selectedPagesValue === 'string') {
    try {
      const parsed: unknown = JSON.parse(selectedPagesValue)
      if (
        Array.isArray(parsed) &&
        parsed.every((page) => Number.isSafeInteger(page) && page > 0 && page <= totalPages)
      ) {
        selectedPages = [...new Set(parsed as number[])].sort((a, b) => a - b)
      }
    } catch {
      selectedPages = null
    }
  }
  const copies = parsePositiveInteger(form.get('copies'))
  const submittedTotalCostPoisha = parsePositiveInteger(form.get('totalCostPoisha'))
  if (!totalPages || totalPages > MAX_PAGES) {
    return jsonError(`Total pages must be between 1 and ${MAX_PAGES}.`, 400)
  }
  if (!selectedPages?.length) {
    return jsonError('Select at least one valid page to print.', 400)
  }
  if (!copies || copies > MAX_COPIES) {
    return jsonError(`Copies must be between 1 and ${MAX_COPIES}.`, 400)
  }
  if (!submittedTotalCostPoisha) {
    return jsonError('Total cost must be a positive amount in poisha.', 400)
  }
  const price = calculatePrice(selectedPages.length, {
    color: colorValue,
    paperSize: paperSizeValue,
    side: 'single',
    copies,
  })
  const totalCostPoisha = price.grandTotalPoisha
  if (submittedTotalCostPoisha !== totalCostPoisha) {
    return jsonError('Submitted total cost does not match the page count, paper size, color mode, and copies.', 400)
  }

  let originalPdfBuffer: Uint8Array
  try {
    originalPdfBuffer = new Uint8Array(await fileValue.arrayBuffer())
    const pdfDoc = await PDFDocument.load(originalPdfBuffer)
    if (pdfDoc.getPageCount() !== totalPages) {
      return jsonError('The submitted page count does not match the uploaded PDF.', 400)
    }
  } catch {
    return jsonError('The uploaded file is not a valid PDF.', 400)
  }

  console.log('RPC Call Details:', { userId: user.id, totalCostPoisha })
  let isSuccess: unknown
  let rpcErr: { message: string } | null
  try {
    const result = await supabaseAdmin.rpc('atomic_deduct_print_cost', {
      p_user_id: user.id,
      p_amount_poisha: totalCostPoisha,
    })
    isSuccess = result.data
    rpcErr = result.error
  } catch (error) {
    rpcErr = error instanceof Error ? { message: error.message } : { message: String(error) }
    console.log('RPC Failure:', rpcErr)
    return NextResponse.json(
      { error: rpcErr.message || 'Insufficient wallet balance or wallet not found.' },
      { status: 400 },
    )
  }
  if (rpcErr || !isSuccess) {
    console.log('RPC Failure:', rpcErr)
    return NextResponse.json(
      { error: rpcErr?.message || 'Insufficient wallet balance or wallet not found.' },
      { status: 400 },
    )
  }
  const deductionConfirmed =
    isSuccess === true ||
    (typeof isSuccess === 'object' &&
      isSuccess !== null &&
      (('success' in isSuccess && isSuccess.success === true) ||
        ('deducted' in isSuccess && isSuccess.deducted === true)))
  if (!deductionConfirmed) {
    return jsonError('Insufficient wallet credit for this print job.', 402)
  }

  const token = makeOrderToken()
  const tokenCode = token.replace(/^#/, '')
  const colorLabel = colorValue === 'color' ? 'Full Color' : 'Black & White'
  const totalCostBdt = (totalCostPoisha / 100).toFixed(2)
  const caption = makeTelegramCaption({
    tokenCode,
    customerName: finalCustomerName,
    customerPhone: phoneValue.trim(),
    deliveryOption: finalDeliveryOption,
    selectedPageCount: selectedPages.length,
    pageRange: finalPageRange,
    colorMode: colorValue,
    paperSize: paperSizeValue,
    copies,
    totalCostBdt,
    deliveryNotes,
  })

  try {
    const stampPdfBuffer = await createStampPdf({
      tokenCode,
      customerName: finalCustomerName,
      customerPhone: phoneValue.trim(),
      selectedPageCount: selectedPages.length,
      pageRange: finalPageRange,
      colorMode: colorValue,
      paperSize: paperSizeValue,
      copies,
      deliveryOption: finalDeliveryOption,
      totalCostBdt: totalCostPoisha / 100,
    })

    const { data: job, error: insertError } = await supabaseAdmin
      .from('print_jobs')
      .insert({
        token,
        user_id: user.id,
        customer_name: finalCustomerName,
        customer_phone: phoneValue.trim(),
        delivery_option: finalDeliveryOption,
        total_pages: selectedPages.length,
        color_mode: colorLabel,
        paper_size: paperSizeValue,
        copies,
        total_cost_poisha: totalCostPoisha,
        telegram_file_id: null,
        file_storage_path: null,
        status: 'QUEUED',
      })
      .select('id')
      .single()

    if (insertError) throw insertError
    if (!job) throw new Error('Print job insert returned no record.')

    const { error: tokenInsertError } = await supabaseAdmin
      .from('print_tokens')
      .insert({
        token_code: tokenCode,
        token: tokenCode,
        print_job_id: job.id,
      })
    if (tokenInsertError) throw tokenInsertError

    const telegramFileId = await submitMediaGroupToTelegram({
      stampPdfBuffer,
      originalPdfBuffer,
      originalFilename,
      tokenCode,
      caption,
      botToken: telegramBotToken,
      chatId: telegramChatId,
    })
    const { error: updateError } = await supabaseAdmin
      .from('print_jobs')
      .update({ telegram_file_id: telegramFileId })
      .eq('id', job.id)
    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      token,
      job_id: job.id,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof error.message === 'string'
          ? error.message
          : String(error)
    console.error(`Order creation or dispatch failed for ${token}:`, error)

    try {
      const { data: refundResult, error: refundError } = await supabaseAdmin.rpc(
        'atomic_wallet_topup',
        {
          p_user_id: user.id,
          p_amount_poisha: totalCostPoisha,
        },
      )

      const refundRejected =
        refundResult === false ||
        (typeof refundResult === 'object' &&
          refundResult !== null &&
          'success' in refundResult &&
          refundResult.success === false)

      if (refundError || refundRejected) {
        console.error(`Wallet refund failed for ${token}:`, refundError ?? refundResult)
      }
    } catch (refundError) {
      console.error(`Wallet refund request failed for ${token}:`, refundError)
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
