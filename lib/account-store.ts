export interface Account {
  name: string
  email: string
  balance: number
  phone?: string
  createdAt?: string
}

export interface AccountPrintOrder {
  token: string
  submittedAt: string
  fileName: string
  pages: number
  paperSize: 'A4' | 'Legal'
  color: 'B&W'
  printSide?: 'Single' | 'Duplex' | 'SINGLE' | 'DUPLEX'
  uploadMethod?: 'DIRECT' | 'WHATSAPP' | 'TELEGRAM' | string
  copies: number
  deliveryOption?: string | null
  address: string
  notes?: string | null
  total: number
  status: 'QUEUED' | 'PRINTED' | 'DELIVERED' | 'CANCELLED'
  fileStoragePath?: string | null
}

export interface WalletTransaction {
  id: string
  date: string
  type: 'TOP_UP' | 'PRINT_JOB'
  description: string
  amount: number
  trxId: string | null
  status: 'COMPLETED' | 'FAILED' | 'REFUNDED'
}
