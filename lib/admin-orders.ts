import type { ManualPaperSize } from '@/lib/manual-order'
import type { PrintColor } from '@/lib/print'

export interface CreateAdminManualOrderInput {
  userId: string
  customerName?: string
  customerPhone?: string
  paperSize: ManualPaperSize
  colorMode: PrintColor
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
  colorMode,
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
      colorMode,
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
