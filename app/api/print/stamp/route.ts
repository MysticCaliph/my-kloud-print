import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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
  if (profile?.role !== 'operator') {
    return jsonError('Operator access is required.', 403)
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('print_jobs')
    .select('token, customer_name, customer_phone, delivery_option, total_pages, color_mode, copies, total_cost_poisha')
    .eq('id', id)
    .maybeSingle()
  if (jobError) {
    console.error('Print stamp job lookup failed:', jobError)
    return jsonError('Could not load the print job.', 500)
  }
  if (!job) return jsonError('Print job not found.', 404)

  try {
    const qrPng = await QRCode.toBuffer(job.token, { margin: 1, width: 80 })
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([148.82, 210.47])
    const qrImage = await pdf.embedPng(qrPng)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const black = rgb(0.08, 0.1, 0.13)
    const deliveryOption = String(job.delivery_option || 'None')
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
    page.drawText(`#${String(job.token).replace(/^#/, '')}`, {
      x: 8,
      y: 173,
      size: 9,
      font: bold,
      color: black,
    })
    page.drawText(`Name: ${job.customer_name || 'Customer'}`, {
      x: 8,
      y: 158,
      size: 7.5,
      font: regular,
      color: black,
      maxWidth: 132,
    })
    page.drawText(`Phone: ${job.customer_phone}`, {
      x: 8,
      y: 146,
      size: 7.5,
      font: regular,
      color: black,
      maxWidth: 132,
    })
    page.drawText(
      `Specs: ${job.total_pages} pgs | ${job.color_mode} | x${job.copies}`,
      {
        x: 8,
        y: 133,
        size: 7,
        font: regular,
        color: black,
        maxWidth: 132,
      },
    )
    page.drawText(`Delivery: ${deliveryLabel}`, {
      x: 8,
      y: 120,
      size: 6.5,
      font: regular,
      color: black,
      maxWidth: 132,
    })
    page.drawText(`Total: Tk. ${(Number(job.total_cost_poisha) / 100).toFixed(2)}`, {
      x: 8,
      y: 106,
      size: 8,
      font: bold,
      color: black,
      maxWidth: 132,
    })
    page.drawImage(qrImage, {
      x: 95,
      y: 24,
      width: 45,
      height: 45,
    })

    const pdfBytes = await pdf.save()
    const filenameToken = String(job.token).replace(/[^A-Za-z0-9_-]/g, '_')
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Stamp-${filenameToken}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Print stamp PDF generation failed:', error)
    return jsonError(
      error instanceof Error ? error.message : 'Could not generate the print stamp.',
      500,
    )
  }
}
