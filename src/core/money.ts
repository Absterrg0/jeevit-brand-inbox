/**
 * Money parsing. The model copies the fee as written ("Rs 3 lakh", "USD 1,200",
 * "25k"); this turns it into a number. Arithmetic on money is never left to the model.
 */
import type { Money } from '../types'

const UNIT: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  hazaar: 1e3,
  hazar: 1e3,
  l: 1e5,
  lac: 1e5,
  lacs: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  m: 1e6,
  mn: 1e6,
  million: 1e6,
  cr: 1e7,
  crore: 1e7,
  crores: 1e7,
}

const USD = /(\$|\busd\b|\bus dollars?\b|\bdollars?\b)/i
const INR = /(₹|\binr\b|\brs\.?(?=\s|\d|$)|\brupees?\b|\brupaye\b)/i

/** Returns null when no number can be read. Never guesses a figure. */
export function parseMoney(text: string | null | undefined, usdToInr: number): Money | null {
  if (!text) return null
  // A number with optional Indian/western grouping, optional decimal, optional unit word.
  const match = /(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d+)?\s*([a-z]+)?/i.exec(text)
  if (!match) return null
  const base = Number(match[1].replace(/,/g, '') + (match[2] ?? ''))
  const unit = match[3] ? UNIT[match[3].toLowerCase()] : undefined
  const amount = Math.round(base * (unit ?? 1))
  if (!Number.isFinite(amount) || amount <= 0) return null

  const isUsd = USD.test(text)
  const isInr = INR.test(text)
  const currency = isUsd && !isInr ? 'USD' : 'INR'
  return {
    amount,
    currency,
    inr: currency === 'USD' ? Math.round(amount * usdToInr) : amount,
    currencyAssumed: !isUsd && !isInr,
    text: text.trim(),
  }
}

/** ₹1,20,000 with Indian grouping; $1,200 with western grouping. */
export function formatMoney(amount: number, currency: 'INR' | 'USD'): string {
  return currency === 'USD' ? `USD ${amount.toLocaleString('en-US')}` : `INR ${amount.toLocaleString('en-IN')}`
}

export const formatInr = (amount: number) => `₹${amount.toLocaleString('en-IN')}`
