import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function generateManualJobReceiptPdf(job: {
  order_token: string
  job_title?: string
  paper_size?: string
  print_type?: string
  page_count: number
  copies: number
  total_price: number
  created_at: string
  customer_info?: string
}) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([148.82, 210.47])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const dark = rgb(0.1, 0.13, 0.17)
  const green = rgb(0.1, 0.55, 0.3)

  page.drawRectangle({
    x: 0.5,
    y: 0.5,
    width: width - 1,
    height: height - 1,
    borderColor: rgb(0.65, 0.68, 0.7),
    borderWidth: 0.5,
  })
  page.drawText('PrintKloud', {
    x: 8,
    y: height - 18,
    size: 10,
    font: boldFont,
    color: dark,
  })
  page.drawLine({
    start: { x: 8, y: height - 25 },
    end: { x: width - 8, y: height - 25 },
    thickness: 0.6,
    color: rgb(0.8, 0.82, 0.84),
  })

  const createdAt = new Date(job.created_at)
  const createdDate = Number.isNaN(createdAt.getTime())
    ? 'Date unavailable'
    : createdAt.toLocaleString('en-BD', { dateStyle: 'short', timeStyle: 'short' })
  const details: [string, string][] = [
    ['Order', job.order_token || 'N/A'],
    ['Pages', String(job.page_count)],
    ['Copies', String(job.copies)],
    ['Total', `BDT ${job.total_price.toFixed(2)}`],
    ['Created', createdDate],
  ]
  if (job.paper_size || job.print_type) {
    details.push(['Specs', `${job.paper_size || 'A4'} ${job.print_type || 'B&W'}`])
  }
  if (job.job_title) details.push(['Title', job.job_title])
  if (job.customer_info) details.push(['Customer', job.customer_info])

  let y = height - 39
  for (const [label, value] of details) {
    page.drawText(`${label}:`, {
      x: 8,
      y,
      size: 5.5,
      font: boldFont,
      color: dark,
    })
    page.drawText(value.slice(0, 32), {
      x: 43,
      y,
      size: 5.5,
      font,
      color: dark,
      maxWidth: width - 51,
    })
    y -= 10
  }

  const stampY = 18
  page.drawRectangle({
    x: 8,
    y: stampY - 9,
    width: width - 16,
    height: 16,
    borderColor: green,
    borderWidth: 1,
    color: rgb(0.93, 0.98, 0.94),
  })
  page.drawLine({
    start: { x: 13, y: stampY - 2 },
    end: { x: 16, y: stampY - 5 },
    thickness: 1.2,
    color: green,
  })
  page.drawLine({
    start: { x: 16, y: stampY - 5 },
    end: { x: 21, y: stampY + 2 },
    thickness: 1.2,
    color: green,
  })
  page.drawText('VERIFIED & STAMPED', {
    x: 25,
    y: stampY - 2,
    size: 6.5,
    font: boldFont,
    color: green,
  })

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
}
