import type { ManualPaperSize, ManualPrintSide } from '@/lib/manual-order'

export interface CreateAdminManualOrderInput {
  userId: string
  customerName?: string
  customerPhone?: string
  paperSize: ManualPaperSize
  printSide?: ManualPrintSide
  totalPages: number
  copies: number
  deliveryOption?: string
  deductFromWallet: boolean
  originalFilename?: string
}

interface CreateAdminManualOrderResponse {
  success?: boolean
  job?: {
    id: string
    token: string
    totalCostPoisha: number
  }
  error?: string
}

export async function createAdminManualOrder({
  userId,
  customerName,
  customerPhone,
  paperSize,
  printSide = 'SINGLE',
  totalPages,
  copies,
  deliveryOption,
  deductFromWallet,
  originalFilename,
}: CreateAdminManualOrderInput) {
  const response = await fetch('/api/admin/manual-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      customerName,
      customerPhone,
      paperSize,
      printSide,
      colorMode: 'bw',
      totalPages,
      copies,
      deliveryOption: deliveryOption || 'Admin Creation',
      deductFromWallet,
      originalFilename: originalFilename || 'Manual Admin Job (No PDF)',
    }),
  })
  const result = (await response.json()) as CreateAdminManualOrderResponse

  if (!response.ok || !result.success || !result.job) {
    throw new Error(result.error ?? 'Could not create the manual print job.')
  }

  return result.job
}
