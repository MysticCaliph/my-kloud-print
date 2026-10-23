import { randomBytes, randomInt } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { calculatePrice, isCustomDeliveryOption, type PaperSize } from '@/lib/print'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 52,428,800 bytes
const MAX_PAGES = 2000
const MAX_COPIES = 99

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
  paperSize,
  printSide,
  uploadMethod,
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
  paperSize: string
  printSide: string
  uploadMethod: string
  copies: number
  totalCostBdt: string
  deliveryNotes: string
}) {
  const deliveryHeader =
    deliveryOption === 'Not specified (Customer skipped)'
      ? 'Customer skipped handoff arrangement'
      : deliveryOption
  const lines = [
    `*Order #${escapeMarkdown(tokenCode)}* · *PRINT ORDER*`,
    `Customer: ${escapeMarkdown(customerName)} (${escapeMarkdown(customerPhone)})`,
    `Method: ${escapeMarkdown(uploadMethod)}`,
    `Pages: ${selectedPageCount} (${escapeMarkdown(pageRange)})`,
    `Specs: ${escapeMarkdown(paperSize)} · ${escapeMarkdown(printSide)} · B&W`,
    `Copies: ${copies}`,
    `Delivery: ${escapeMarkdown(deliveryHeader)}`,
    `Total: Tk. ${totalCostBdt}`,
  ]
  if (deliveryNotes) lines.push(`Notes: ${escapeMarkdown(deliveryNotes)}`)
  return lines.join('\n')
}

async function createStampPdf({
  tokenCode,
  customerName,
  customerPhone,
  selectedPageCount,
  pageRange,
  paperSize,
  printSide,
  uploadMethod,
  copies,
  deliveryOption,
  totalCostBdt,
}: {
  tokenCode: string
  customerName: string
  customerPhone: string
  selectedPageCount: number
  pageRange: string
  paperSize: string
  printSide: string
  uploadMethod: string
  copies: number
  deliveryOption: string
  totalCostBdt: number
}) {
  const qrPng = await QRCode.toBuffer(tokenCode, { margin: 1, width: 80 })
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([148.82, 210.47])
  const qrImage = await pdf.embedPng(qrPng)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const black = rgb(0.08, 0.1, 0.13)
  const deliveryLabel =
    deliveryOption.length > 36 ? `${deliveryOption.slice(0, 33)}...` : deliveryOption

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
    y: 190,
    size: 12,
    font: bold,
    color: black,
  })
  page.drawText(`#${tokenCode}`, {
    x: 8,
    y: 173,
    size: 9,
    font: bold,
    color: black,
  })
  page.drawText(`Name: ${customerName}`, {
    x: 8,
    y: 158,
    size: 7.5,
    font: regular,
    color: black,
    maxWidth: 132,
  })
  page.drawText(`Phone: ${customerPhone}`, {
    x: 8,
    y: 146,
    size: 7.5,
    font: regular,
    color: black,
    maxWidth: 132,
  })
  page.drawText(
    `Specs: ${selectedPageCount} pgs (${pageRange}) | ${paperSize} ${printSide} B&W | x${copies}`,
    {
      x: 8,
      y: 133,
      size: 6.5,
      font: regular,
      color: black,
      maxWidth: 132,
    },
  )
  page.drawText(`Method: ${uploadMethod}`, {
    x: 8,
    y: 121,
    size: 6.5,
    font: bold,
    color: black,
    maxWidth: 132,
  })
  page.drawText(`Delivery: ${deliveryLabel}`, {
    x: 8,
    y: 110,
    size: 6.5,
    font: regular,
    color: black,
    maxWidth: 132,
  })
  page.drawText(`Total: Tk. ${totalCostBdt.toFixed(2)}`, {
    x: 8,
    y: 97,
    size: 8,
    font: bold,
    color: black,
    maxWidth: 132,
  })
  page.drawImage(qrImage, {
    x: 95,
    y: 20,
    width: 45,
    height: 45,
  })

  return pdf.save()
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
  const telegramFormData = new FormData()
  telegramFormData.append('chat_id', chatId)
  telegramFormData.append(
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
  telegramFormData.append(
    'stamp',
    new Blob([stampPdfBuffer as BlobPart], { type: 'application/pdf' }),
    `Stamp-${tokenCode}.pdf`,
  )
  telegramFormData.append(
    'original',
    new Blob([originalPdfBuffer as BlobPart], { type: 'application/pdf' }),
    originalFilename,
  )

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMediaGroup`,
    {
      method: 'POST',
      body: telegramFormData,
    },
  )
  const result = (await telegramResponse.json()) as TelegramSendMediaGroupResponse
  if (!telegramResponse.ok || !result.ok) {
    const detail = result.description ? ` - ${result.description}` : ''
    throw new Error(`Telegram delivery failed${detail}`)
  }
  const fileId = result.result?.[1]?.document?.file_id
  if (!fileId) throw new Error('Telegram response did not return an uploaded document ID.')
  return fileId
}

export async function POST(request: Request) {
  let supabase
  try {
    supabase = await createSupabaseServerClient()
  } catch (error) {
    console.error('Print submission authentication configuration error:', error)
    return jsonError('Authentication is not configured on the server.', 503)
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
  const deliveryAddressValue = form.get('deliveryAddress')
  const deliveryNotesValue = form.get('deliveryNotes')
  const pageRangeValue = form.get('pageRange') ?? form.get('selectedPageRange')
  const paperSizeValue = form.get('paperSize')
  const selectedPagesValue = form.get('selectedPages')
  const uploadMethodRaw = (form.get('uploadMethod') as string) || 'DIRECT'
  const uploadMethod: 'DIRECT' | 'WHATSAPP' | 'TELEGRAM' =
    ['WHATSAPP', 'TELEGRAM'].includes(uploadMethodRaw.toUpperCase())
      ? (uploadMethodRaw.toUpperCase() as 'WHATSAPP' | 'TELEGRAM')
      : 'DIRECT'
  const printSideRaw = (form.get('printSide') as string) || 'SINGLE'
  const printSide: 'SINGLE' | 'DUPLEX' =
    printSideRaw.toUpperCase() === 'DUPLEX' ? 'DUPLEX' : 'SINGLE'

  if (typeof submittedUserId !== 'string' || submittedUserId !== user.id) {
    return jsonError('The submitted user does not match the signed-in account.', 403)
  }
  if (typeof phoneValue !== 'string' || phoneValue.trim().length < 7 || phoneValue.length > 40) {
    return jsonError('Enter a valid customer phone number.', 400)
  }
  if (paperSizeValue !== 'A4' && paperSizeValue !== 'Legal') {
    return jsonError('Paper size must be "A4" or "Legal".', 400)
  }

  const deliveryOption =
    typeof deliveryOptionValue === 'string' && deliveryOptionValue.trim()
      ? deliveryOptionValue.trim()
      : 'Not specified (Customer skipped)'
  const deliveryAddress =
    typeof deliveryAddressValue === 'string' ? deliveryAddressValue.trim() : ''
  const deliveryNotes =
    typeof deliveryNotesValue === 'string' ? deliveryNotesValue.trim() : ''

  if (isCustomDeliveryOption(deliveryOption) && !deliveryAddress) {
    return jsonError(
      'Please enter a delivery location / place name for "Any Other Place (Charge Applicable)".',
      400,
    )
  }

  const totalPages = parsePositiveInteger(form.get('totalPages'))
  const copies = parsePositiveInteger(form.get('copies'))
  const submittedTotalCostPoisha = parsePositiveInteger(form.get('totalCostPoisha'))

  if (!totalPages || totalPages > MAX_PAGES) {
    return jsonError(`Total pages must be between 1 and ${MAX_PAGES}.`, 400)
  }
  if (!copies || copies > MAX_COPIES) {
    return jsonError(`Copies must be between 1 and ${MAX_COPIES}.`, 400)
  }
  if (!submittedTotalCostPoisha) {
    return jsonError('Total cost must be a positive amount in poisha.', 400)
  }

  let originalFilename = 'document.pdf'
  let originalPdfBuffer: Uint8Array | null = null

  if (uploadMethod === 'DIRECT') {
    if (!(fileValue instanceof File)) {
      return jsonError('A PDF file is required for direct upload.', 400)
    }
    if (fileValue.size === 0 || fileValue.size > MAX_FILE_SIZE) {
      return jsonError(
        'The PDF must be between 1 byte and 50 MB (52,428,800 bytes). For larger files, please choose the WhatsApp or Telegram option.',
        400,
      )
    }
    if (
      !fileValue.name.toLowerCase().endsWith('.pdf') &&
      fileValue.type !== 'application/pdf'
    ) {
      return jsonError('Only PDF files are accepted for direct upload.', 400)
    }
    originalFilename =
      fileValue.name.replace(/[\\/\r\n"]/g, '_').trim() || 'original.pdf'

    try {
      originalPdfBuffer = new Uint8Array(await fileValue.arrayBuffer())
      const pdfDoc = await PDFDocument.load(originalPdfBuffer)
      if (pdfDoc.getPageCount() !== totalPages) {
        return jsonError('The submitted page count does not match the uploaded PDF.', 400)
      }
    } catch {
      return jsonError('The uploaded file is not a valid PDF.', 400)
    }
  } else if (uploadMethod === 'WHATSAPP') {
    originalFilename = 'Sent via WhatsApp (01518962340)'
  } else {
    originalFilename = 'Sent via Telegram (01518962340)'
  }

  let selectedPagesCount = totalPages
  if (uploadMethod === 'DIRECT' && typeof selectedPagesValue === 'string') {
    try {
      const parsed: unknown = JSON.parse(selectedPagesValue)
      if (Array.isArray(parsed) && parsed.length > 0) {
        selectedPagesCount = parsed.length
      }
    } catch {
      selectedPagesCount = totalPages
    }
  }

  const price = calculatePrice(selectedPagesCount, {
    color: 'bw',
    paperSize: paperSizeValue,
    side: printSide === 'DUPLEX' ? 'duplex' : 'single',
    copies,
    deliveryOption,
  })
  const totalCostPoisha = price.grandTotalPoisha
  if (submittedTotalCostPoisha !== totalCostPoisha) {
    return jsonError(
      'Submitted total cost does not match the page count, paper size, print side, and delivery option.',
      400,
    )
  }

  // Deduct from wallet atomically
  let isSuccess: unknown
  let rpcErr: { message: string } | null = null
  try {
    const result = await supabaseAdmin.rpc('atomic_deduct_print_cost', {
      p_user_id: user.id,
      p_amount_poisha: totalCostPoisha,
    })
    isSuccess = result.data
    rpcErr = result.error
  } catch (error) {
    rpcErr = error instanceof Error ? { message: error.message } : { message: String(error) }
  }

  if (rpcErr || !isSuccess) {
    return NextResponse.json(
      { error: rpcErr?.message || 'Insufficient wallet balance or wallet not found.' },
      { status: 400 },
    )
  }

  const token = makeOrderToken()
  const tokenCode = token.replace(/^#/, '')
  const totalCostBdt = (totalCostPoisha / 100).toFixed(2)
  const finalPageRange =
    typeof pageRangeValue === 'string' && pageRangeValue.trim()
      ? pageRangeValue.trim()
      : 'All'

  try {
    const { data: job, error: insertError } = await supabaseAdmin
      .from('print_jobs')
      .insert({
        token,
        user_id: user.id,
        customer_name: finalCustomerName,
        customer_phone: phoneValue.trim(),
        delivery_option: deliveryOption,
        delivery_address: deliveryAddress || null,
        delivery_notes: deliveryNotes || null,
        total_pages: selectedPagesCount,
        color_mode: 'bw',
        paper_size: paperSizeValue,
        print_side: printSide,
        upload_method: uploadMethod,
        copies,
        total_cost_poisha: totalCostPoisha,
        original_filename: originalFilename,
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

    // Handle Telegram dispatch
    const deliveryWithAddress = deliveryAddress
      ? `${deliveryOption} (${deliveryAddress})`
      : deliveryOption

    if (uploadMethod === 'DIRECT' && originalPdfBuffer && telegramBotToken && telegramChatId) {
      try {
        const stampPdfBuffer = await createStampPdf({
          tokenCode,
          customerName: finalCustomerName,
          customerPhone: phoneValue.trim(),
          selectedPageCount: selectedPagesCount,
          pageRange: finalPageRange,
          paperSize: paperSizeValue,
          printSide: printSide === 'DUPLEX' ? 'Duplex' : 'Single',
          uploadMethod,
          copies,
          deliveryOption: deliveryWithAddress,
          totalCostBdt: totalCostPoisha / 100,
        })

        const caption = makeTelegramCaption({
          tokenCode,
          customerName: finalCustomerName,
          customerPhone: phoneValue.trim(),
          deliveryOption: deliveryWithAddress,
          selectedPageCount: selectedPagesCount,
          pageRange: finalPageRange,
          paperSize: paperSizeValue,
          printSide: printSide === 'DUPLEX' ? 'Duplex' : 'Single',
          uploadMethod,
          copies,
          totalCostBdt,
          deliveryNotes,
        })

        const telegramFileId = await submitMediaGroupToTelegram({
          stampPdfBuffer,
          originalPdfBuffer,
          originalFilename,
          tokenCode,
          caption,
          botToken: telegramBotToken,
          chatId: telegramChatId,
        })

        await supabaseAdmin
          .from('print_jobs')
          .update({ telegram_file_id: telegramFileId })
          .eq('id', job.id)
      } catch (tgError) {
        console.error('Telegram dispatch error for DIRECT upload:', tgError)
      }
    } else if (telegramBotToken && telegramChatId) {
      // Notify Telegram channel of WhatsApp or Telegram submission
      const alertText =
        `🖨️ *New ${uploadMethod} Print Order*\n\n` +
        `• *Order:* \`${token}\`\n` +
        `• *Customer:* ${escapeMarkdown(finalCustomerName)} (${phoneValue.trim()})\n` +
        `• *Specs:* ${selectedPagesCount} pgs · ${paperSizeValue} · ${printSide} · B&W · x${copies}\n` +
        `• *Total:* Tk. ${totalCostBdt}\n` +
        `• *Method:* ${uploadMethod} (Customer sends file directly)\n` +
        `• *Delivery:* ${escapeMarkdown(deliveryWithAddress)}` +
        (deliveryNotes ? `\n• *Notes:* ${escapeMarkdown(deliveryNotes)}` : '')

      await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: alertText,
          parse_mode: 'Markdown',
        }),
      }).catch((tgErr) => console.error('Telegram text alert failed:', tgErr))
    }

    return NextResponse.json({
      success: true,
      token,
      job_id: job.id,
    })
  } catch (error) {
    console.error(`Order creation failed for ${token}:`, error)
    // Refund wallet deduction on failure
    try {
      await supabaseAdmin.rpc('atomic_wallet_topup', {
        p_user_id: user.id,
        p_amount_poisha: totalCostPoisha,
      })
    } catch {
      // Ignore refund error on cleanup attempt
    }
    return jsonError('Could not finalize the order. Your wallet balance has been refunded.', 500)
  }
}
