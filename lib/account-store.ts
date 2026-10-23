'use client'

import { useSyncExternalStore } from 'react'

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
  address: string
  total: number
  status: 'QUEUED' | 'PRINTED' | 'DELIVERED'
  fileStoragePath?: string | null
}

export interface WalletTransaction {
  id: string
  date: string
  type: 'TOP_UP' | 'PRINT_JOB'
  description: string
  amount: number
  trxId: string | null
  status: 'COMPLETED' | 'FAILED'
}

interface StoredUser extends Account {
  passwordHash: string
  salt: string
}

type UserDb = Record<string, StoredUser>

const USERS_KEY = 'printkloud:users'
const SESSION_KEY = 'printkloud:session'
const ORDERS_KEY = 'printkloud:orders'
const LEDGER_KEY = 'printkloud:wallet-ledger'
const CHANGE_EVENT = 'printkloud:account-change'

function readUsers(): UserDb {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}') as UserDb
  } catch {
    return {}
  }
}

function writeUsers(users: UserDb) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function setSession(email: string | null) {
  if (email) localStorage.setItem(SESSION_KEY, email)
  else localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export async function signUp(name: string, email: string, password: string, phone: string) {
  const key = normalizeEmail(email)
  const users = readUsers()
  if (users[key]) throw new Error('An account with this email already exists.')
  const salt = crypto.randomUUID()
  users[key] = {
    name: name.trim(),
    email: key,
    balance: 0,
    phone: phone.trim(),
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: await hashPassword(password, salt),
  }
  writeUsers(users)
  setSession(key)
}

export async function signIn(email: string, password: string) {
  const key = normalizeEmail(email)
  const user = readUsers()[key]
  if (!user || user.passwordHash !== (await hashPassword(password, user.salt))) {
    throw new Error('Incorrect email or password.')
  }
  setSession(key)
}

export function updatePhone(phone: string) {
  const email = localStorage.getItem(SESSION_KEY)
  const users = readUsers()
  const user = email ? users[email] : undefined
  if (!user) throw new Error('You must be signed in.')
  user.phone = phone.trim()
  writeUsers(users)
}

export function signOut() {
  setSession(null)
}

export function adjustBalance(delta: number) {
  const email = localStorage.getItem(SESSION_KEY)
  const users = readUsers()
  const user = email ? users[email] : undefined
  if (!user) throw new Error('You must be signed in.')
  const next = Math.round((user.balance + delta) * 100) / 100
  if (next < 0) throw new Error('Insufficient balance.')
  user.balance = next
  writeUsers(users)
}

function readAccountList<T>(key: string, email: string): T[] {
  try {
    const entries = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, T[]>
    return Array.isArray(entries[email]) ? entries[email] : []
  } catch {
    return []
  }
}

function writeAccountList<T>(key: string, email: string, items: T[]) {
  let entries: Record<string, T[]> = {}
  try {
    entries = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, T[]>
  } catch {
    entries = {}
  }
  entries[email] = items
  localStorage.setItem(key, JSON.stringify(entries))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function getPrintOrders(email: string) {
  return readAccountList<AccountPrintOrder>(ORDERS_KEY, normalizeEmail(email))
}

export function savePrintOrder(
  order: Omit<AccountPrintOrder, 'token' | 'submittedAt' | 'status'>,
) {
  const email = localStorage.getItem(SESSION_KEY)
  if (!email) throw new Error('You must be signed in to save a print order.')
  const orders = getPrintOrders(email)
  let token: string
  do {
    token = `#PRT-${String(Math.floor(1000 + Math.random() * 9000))}`
  } while (orders.some((existing) => existing.token === token))
  writeAccountList(ORDERS_KEY, email, [
    {
      ...order,
      token,
      submittedAt: new Date().toISOString(),
      status: 'QUEUED',
    },
    ...orders,
  ])
  return token
}

export function getWalletLedger(email: string) {
  return readAccountList<WalletTransaction>(LEDGER_KEY, normalizeEmail(email))
}

export function saveWalletTransaction(
  transaction: Omit<WalletTransaction, 'id' | 'date'>,
) {
  const email = localStorage.getItem(SESSION_KEY)
  if (!email) throw new Error('You must be signed in to save a wallet transaction.')
  const ledger = getWalletLedger(email)
  writeAccountList(LEDGER_KEY, email, [
    {
      ...transaction,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    },
    ...ledger,
  ])
}

let cachedRaw: string | null = null
let cachedAccount: Account | null = null

function getSnapshot(): Account | null {
  const email = localStorage.getItem(SESSION_KEY)
  const user = email ? readUsers()[email] : undefined
  const raw = user
    ? `${user.email}|${user.name}|${user.balance}|${user.phone ?? ''}|${user.createdAt ?? ''}`
    : null
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedAccount = user
      ? {
          name: user.name,
          email: user.email,
          balance: user.balance,
          phone: user.phone,
          createdAt: user.createdAt,
        }
      : null
  }
  return cachedAccount
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function useAccount() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
