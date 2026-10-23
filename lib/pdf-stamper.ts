import { PDFDocument, StandardFonts, degrees, rgb, type PDFImage } from 'pdf-lib'
import QRCode from 'qrcode'
import {
  calculateDeliveryFeePoisha,
  calculatePrintCostPoisha,
  type PaperSize,
} from '@/lib/print'

export interface OfficialReceiptData {
  order_token: string
  customer_name?: string
  customer_phone?: string
  customer_info?: string
  upload_method?: 'DIRECT' | 'WHATSAPP' | 'TELEGRAM' | string
  paper_size?: 'A4' | 'Legal' | 'LEGAL' | string
  print_side?: 'Single' | 'Duplex' | 'SINGLE' | 'DUPLEX' | string
  page_count: number
  total_pages?: number
  copies: number
  total_price?: number
  total_cost_poisha?: number | bigint
  delivery_option?: string | null
  delivery_address?: string | null
  delivery_notes?: string | null
  created_at: string
  job_title?: string
  print_type?: string
  logo_bytes?: Uint8Array
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function formatReceiptDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    const now = new Date()
    return `${now.getDate()} ${MONTH_NAMES[now.getMonth()]}, ${now.getFullYear()}`
  }
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}, ${date.getFullYear()}`
}

function parseCustomerFields(data: OfficialReceiptData): { name: string; phone: string } {
  let name = data.customer_name?.trim() || ''
  let phone = data.customer_phone?.trim() || ''

  if ((!name || !phone) && data.customer_info) {
    const info = data.customer_info.trim()
    const dashParts = info.split(/\s+-\s+/)
    if (dashParts.length >= 2) {
      if (!name) name = dashParts[0].trim()
      if (!phone) phone = dashParts.slice(1).join(' - ').trim()
    } else {
      const parenMatch = info.match(/^(.+?)\s*\(([^)]+)\)$/)
      if (parenMatch) {
        if (!name) name = parenMatch[1].trim()
        if (!phone) phone = parenMatch[2].trim()
      } else if (!name) {
        name = info
      }
    }
  }

  return {
    name: name || 'Walk-in / Guest',
    phone: phone || 'N/A',
  }
}

async function generateQrPngBuffer(payload: string): Promise<Uint8Array> {
  if (typeof QRCode.toBuffer === 'function') {
    const buffer = await QRCode.toBuffer(payload, {
      type: 'png',
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
    return new Uint8Array(buffer)
  }

  const dataUrl = await QRCode.toDataURL(payload, {
    type: 'image/png',
    width: 180,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  })
  const base64 = dataUrl.split(',')[1] ?? ''
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function resolveLogoBytes(provided?: Uint8Array): Promise<Uint8Array | null> {
  if (provided && provided.byteLength > 0) {
    return provided
  }
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    for (const url of ['/logo.jpg', '/icon.jpg']) {
      try {
        const res = await fetch(url)
        if (res.ok) {
          const buf = await res.arrayBuffer()
          if (buf.byteLength > 0) return new Uint8Array(buf)
        }
      } catch {
        // Ignore and try next candidate
      }
    }
  }
  return null
}

async function embedLogoImage(pdfDoc: PDFDocument, bytes: Uint8Array | null): Promise<PDFImage | null> {
  if (!bytes || bytes.byteLength < 4) return null
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      return await pdfDoc.embedPng(bytes)
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      return await pdfDoc.embedJpg(bytes)
    }
    return await pdfDoc.embedPng(bytes)
  } catch {
    try {
      return await pdfDoc.embedJpg(bytes)
    } catch {
      return null
    }
  }
}

export async function createOfficialReceiptPdfBytes(data: OfficialReceiptData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const width = 380
  const height = 720
  const page = pdfDoc.addPage([width, height])

  const courier = await pdfDoc.embedFont(StandardFonts.Courier)
  const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

  const black = rgb(0, 0, 0)
  const darkGray = rgb(0.18, 0.18, 0.18)
  const white = rgb(1, 1, 1)

  // Clean white receipt slip background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: white,
  })

  // Outer receipt slip border
  page.drawRectangle({
    x: 10,
    y: 10,
    width: width - 20,
    height: height - 20,
    borderColor: black,
    borderWidth: 0.8,
  })

  const marginLeft = 24
  const marginRight = width - 24
  const midX = 176

  const drawDashedHLine = (yPos: number, thickness = 0.85) => {
    page.drawLine({
      start: { x: marginLeft, y: yPos },
      end: { x: marginRight, y: yPos },
      thickness,
      color: black,
      dashArray: [3, 3],
    })
  }

  const drawDashedVLine = (yTop: number, yBottom: number) => {
    page.drawLine({
      start: { x: midX, y: yTop },
      end: { x: midX, y: yBottom },
      thickness: 0.8,
      color: black,
      dashArray: [3, 3],
    })
  }

  // 1. Top-Right Header with Logo & Bold PrintKloud Branding
  const logoBytes = await resolveLogoBytes(data.logo_bytes)
  const logoImage = await embedLogoImage(pdfDoc, logoBytes)

  const logoSize = 34
  const logoX = marginRight - logoSize
  const logoY = height - 52

  if (logoImage) {
    page.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoSize,
      height: logoSize,
    })
  } else {
    page.drawCircle({
      x: logoX + logoSize / 2,
      y: logoY + logoSize / 2,
      size: logoSize / 2 - 1,
      borderColor: black,
      borderWidth: 1.2,
    })
    const pkFallback = 'PK'
    const pkWidth = courierBold.widthOfTextAtSize(pkFallback, 11)
    page.drawText(pkFallback, {
      x: logoX + (logoSize - pkWidth) / 2,
      y: logoY + 12,
      size: 11,
      font: courierBold,
      color: black,
    })
  }

  const brandText = 'PrintKloud'
  const brandSize = 15.5
  const brandWidth = courierBold.widthOfTextAtSize(brandText, brandSize)
  page.drawText(brandText, {
    x: logoX - brandWidth - 8,
    y: logoY + 17,
    size: brandSize,
    font: courierBold,
    color: black,
  })

  const brandSubText = 'printkloud.me'
  const brandSubSize = 7.8
  const brandSubWidth = courier.widthOfTextAtSize(brandSubText, brandSubSize)
  page.drawText(brandSubText, {
    x: logoX - brandSubWidth - 8,
    y: logoY + 5,
    size: brandSubSize,
    font: courier,
    color: darkGray,
  })

  // 2. Centered Title: RECEIPT
  const receiptTitle = 'RECEIPT'
  const receiptTitleSize = 14.5
  const receiptTitleWidth = courierBold.widthOfTextAtSize(receiptTitle, receiptTitleSize)
  page.drawText(receiptTitle, {
    x: (width - receiptTitleWidth) / 2,
    y: height - 74,
    size: receiptTitleSize,
    font: courierBold,
    color: black,
  })

  // Prepare formatted fields
  const { name: customerName, phone: customerPhone } = parseCustomerFields(data)
  const tokenDisplay = data.order_token || 'N/A'
  const uploadMethodDisplay =
    data.upload_method?.toUpperCase() || (data.job_title?.includes('Manual') ? 'MANUAL' : 'DIRECT')
  const paperDisplay: PaperSize =
    data.paper_size?.toUpperCase() === 'LEGAL' ? 'Legal' : 'A4'
  const sideDisplay =
    data.print_side?.toUpperCase() === 'DUPLEX' ? 'Duplex' : 'Single'
  const paperAndSideDisplay = `${paperDisplay} (${sideDisplay})`
  const totalPagesVal = Math.max(1, Number(data.total_pages ?? data.page_count ?? 1))
  const copiesVal = Math.max(1, Number(data.copies || 1))
  const pagesAndCopiesDisplay = `${totalPagesVal}p x ${copiesVal}`

  const totalPoisha =
    data.total_cost_poisha != null
      ? Number(data.total_cost_poisha)
      : Math.round(Number(data.total_price ?? 0) * 100)

  const computedPrintPoisha = calculatePrintCostPoisha(
    totalPagesVal,
    paperDisplay,
    sideDisplay === 'Duplex' ? 'DUPLEX' : 'SINGLE',
    copiesVal,
  )

  const computedDeliveryPoisha =
    data.delivery_option != null
      ? calculateDeliveryFeePoisha(totalPagesVal, copiesVal, data.delivery_option)
      : Math.max(0, totalPoisha - computedPrintPoisha)

  const effectiveDeliveryPoisha =
    computedDeliveryPoisha > 0
      ? computedDeliveryPoisha
      : Math.max(0, totalPoisha - computedPrintPoisha)

  const effectiveOrderAmountPoisha = Math.max(0, totalPoisha - effectiveDeliveryPoisha)

  const orderAmountTk = (effectiveOrderAmountPoisha / 100).toFixed(2)
  const deliveryFeeTk = (effectiveDeliveryPoisha / 100).toFixed(2)
  const totalTk = (totalPoisha / 100).toFixed(2)

  const formattedOrderDate = formatReceiptDate(data.created_at)

  const deliveryPlaceDisplay =
    data.delivery_address?.trim() ||
    data.delivery_option?.trim() ||
    'Standard / Counter'

  const printingNotesDisplay = data.delivery_notes?.trim() || ''

  const fitRightColumnText = (val: string, font: typeof courier, size: number, maxW: number) => {
    const clean = val.replace(/[\r\n]+/g, ' ').trim()
    let trimmed = clean
    while (trimmed.length > 1 && font.widthOfTextAtSize(trimmed, size) > maxW) {
      trimmed = trimmed.slice(0, -1)
    }
    return trimmed
  }

  let cursorY = height - 86
  const sectionHeaderHeight = 19
  const rowHeight = 18.5
  const maxRightColWidth = marginRight - midX - 10

  const drawSection = (title: string, rows: [string, string][], boldValues = false) => {
    drawDashedHLine(cursorY)
    const headerFontSize = 9.2
    const titleWidth = courierBold.widthOfTextAtSize(title, headerFontSize)
    page.drawText(title, {
      x: (width - titleWidth) / 2,
      y: cursorY - 13,
      size: headerFontSize,
      font: courierBold,
      color: black,
    })
    cursorY -= sectionHeaderHeight
    drawDashedHLine(cursorY)

    const rowsStartY = cursorY
    for (let i = 0; i < rows.length; i++) {
      const [label, rawValue] = rows[i]
      const rowTextY = cursorY - 12.5
      const labelFontSize = 8.4
      const valueFontSize = 8.4
      const valueFont = boldValues ? courierBold : courier

      page.drawText(label, {
        x: marginLeft + 4,
        y: rowTextY,
        size: labelFontSize,
        font: courier,
        color: black,
      })

      const fittedValue = fitRightColumnText(rawValue, valueFont, valueFontSize, maxRightColWidth)
      const valWidth = valueFont.widthOfTextAtSize(fittedValue, valueFontSize)
      page.drawText(fittedValue, {
        x: marginRight - 4 - valWidth,
        y: rowTextY,
        size: valueFontSize,
        font: valueFont,
        color: black,
      })

      cursorY -= rowHeight
      if (i < rows.length - 1) {
        drawDashedHLine(cursorY, 0.55)
      }
    }

    const rowsEndY = cursorY
    drawDashedVLine(rowsStartY, rowsEndY)
  }

  // Section 1: Customer Information
  drawSection('Customer Information', [
    ['Customer Name', customerName],
    ['Phone Number', customerPhone],
  ])

  // Section 2: Order Information
  const orderRows: [string, string][] = [
    ['Service Name', 'PrintKloud (B&W)'],
    ['Order Token', tokenDisplay],
    ['Upload Method', uploadMethodDisplay],
    ['Paper & Side', paperAndSideDisplay],
    ['Pages & Copies', pagesAndCopiesDisplay],
    ['Delivery Place', deliveryPlaceDisplay],
  ]
  if (printingNotesDisplay) {
    orderRows.push(['Printing Notes', printingNotesDisplay])
  }
  drawSection('Order Information', orderRows)

  // Section 3: Payment Information
  drawSection('Payment Information', [
    ['PrintKloud Contact', '01518962340'],
    ['Order Date', formattedOrderDate],
    ['Order Amount', `BDT ${orderAmountTk}`],
    ['Delivery / Service Fee', `BDT ${deliveryFeeTk}`],
  ])

  // Section 4: Total Row (Between dashed lines)
  drawDashedHLine(cursorY, 1.0)
  const totalRowTopY = cursorY
  const totalRowHeight = 22
  const totalLabel = 'Payment Received'
  const totalValue = `BDT ${totalTk}`
  const totalFontSize = 9.2

  page.drawText(totalLabel, {
    x: marginLeft + 4,
    y: cursorY - 14.5,
    size: totalFontSize,
    font: courierBold,
    color: black,
  })

  const totalValueWidth = courierBold.widthOfTextAtSize(totalValue, totalFontSize)
  page.drawText(totalValue, {
    x: marginRight - 4 - totalValueWidth,
    y: cursorY - 14.5,
    size: totalFontSize,
    font: courierBold,
    color: black,
  })

  cursorY -= totalRowHeight
  drawDashedVLine(totalRowTopY, cursorY)
  drawDashedHLine(cursorY, 1.0)

  // 5. Bottom Stamp & QR Code Area
  const stampCenterX = 112
  const stampCenterY = 165
  const outerRadius = 44
  const innerRadius = 38

  // Double circle border for vector stamp
  page.drawCircle({
    x: stampCenterX,
    y: stampCenterY,
    size: outerRadius,
    borderColor: black,
    borderWidth: 1.8,
  })
  page.drawCircle({
    x: stampCenterX,
    y: stampCenterY,
    size: innerRadius,
    borderColor: black,
    borderWidth: 0.9,
    borderDashArray: [2, 2],
  })

  // Stamp top & bottom banners
  let stampTopBanner = 'THANK YOU • VERIFIED'
  try {
    courierBold.widthOfTextAtSize(stampTopBanner, 5.5)
  } catch {
    stampTopBanner = 'THANK YOU * VERIFIED'
  }
  const topBannerWidth = courierBold.widthOfTextAtSize(stampTopBanner, 5.5)
  page.drawText(stampTopBanner, {
    x: stampCenterX - topBannerWidth / 2,
    y: stampCenterY + 20,
    size: 5.5,
    font: courierBold,
    color: black,
  })

  const bottomBanner = 'PRINTKLOUD OFFICIAL'
  const bottomBannerWidth = courierBold.widthOfTextAtSize(bottomBanner, 5.3)
  page.drawText(bottomBanner, {
    x: stampCenterX - bottomBannerWidth / 2,
    y: stampCenterY - 24,
    size: 5.3,
    font: courierBold,
    color: black,
  })

  // Tilted "PAID" center inside a double-line stamp bar
  page.drawRectangle({
    x: stampCenterX - 27,
    y: stampCenterY - 10,
    width: 54,
    height: 19,
    borderColor: black,
    borderWidth: 1.2,
    rotate: degrees(12),
  })
  page.drawText('PAID', {
    x: stampCenterX - 17,
    y: stampCenterY - 7,
    size: 14.5,
    font: courierBold,
    color: black,
    rotate: degrees(12),
  })

  // Generate & Embed QR Code
  const qrPayload = `https://printkloud.me/?token=${encodeURIComponent(tokenDisplay)}&amount=${encodeURIComponent(totalTk)}&verified=true`
  const qrPngBytes = await generateQrPngBuffer(qrPayload)
  const qrImage = await pdfDoc.embedPng(qrPngBytes)

  const qrBoxSize = 86
  const qrBoxX = 230
  const qrBoxY = stampCenterY - qrBoxSize / 2 + 4

  page.drawRectangle({
    x: qrBoxX - 4,
    y: qrBoxY - 4,
    width: qrBoxSize + 8,
    height: qrBoxSize + 8,
    borderColor: black,
    borderWidth: 0.8,
    borderDashArray: [3, 3],
  })

  page.drawImage(qrImage, {
    x: qrBoxX,
    y: qrBoxY,
    width: qrBoxSize,
    height: qrBoxSize,
  })

  const qrCaption = 'SCAN TO VERIFY'
  const qrCaptionSize = 7.2
  const qrCaptionWidth = courierBold.widthOfTextAtSize(qrCaption, qrCaptionSize)
  page.drawText(qrCaption, {
    x: qrBoxX + (qrBoxSize - qrCaptionWidth) / 2,
    y: qrBoxY - 14,
    size: qrCaptionSize,
    font: courierBold,
    color: black,
  })

  // 6. Custom Footer at Bottom
  drawDashedHLine(58, 0.75)

  const footerLine1 = 'This receipt has been generated electronically'
  const footerLine1Size = 8.2
  const footerLine1Width = courier.widthOfTextAtSize(footerLine1, footerLine1Size)
  page.drawText(footerLine1, {
    x: (width - footerLine1Width) / 2,
    y: 39,
    size: footerLine1Size,
    font: courier,
    color: darkGray,
  })

  const footerLine2 = 'Please visit printkloud.me for printing your paper.'
  const footerLine2Size = 8.2
  const footerLine2Width = courierBold.widthOfTextAtSize(footerLine2, footerLine2Size)
  page.drawText(footerLine2, {
    x: (width - footerLine2Width) / 2,
    y: 25,
    size: footerLine2Size,
    font: courierBold,
    color: black,
  })

  return pdfDoc.save()
}

export async function generateManualJobReceiptPdf(data: OfficialReceiptData): Promise<Blob> {
  const bytes = await createOfficialReceiptPdfBytes(data)
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
