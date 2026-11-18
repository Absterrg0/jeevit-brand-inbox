import type { Deal, Money } from '../engine/types'
import { daysBetween, formatInr, formatUsd, longDate, shortDate, shortInr, weekdayDate } from '../engine/text'

export { daysBetween, formatInr, formatUsd, longDate, shortDate, shortInr, weekdayDate }

export const money = (fee: Money | null) => {
  if (!fee) return null
  return fee.currency === 'USD' ? formatUsd(fee.amount) : formatInr(fee.amount)
}

/** The secondary line under a fee: what it converts to, when the quote is in USD. */
export const moneyNote = (fee: Money | null) => {
  if (!fee) return null
  if (fee.currency === 'USD') return `${formatInr(fee.inr)} at ₹84/$`
  if (fee.amount >= 100_000) return `${formatUsd(fee.inr / 84)} at ₹84/$`
  return null
}

export const deltaLabel = (deal: Deal) => {
  if (deal.rate.deltaInr === null || deal.rate.pct === null) return null
  const pct = Math.round(deal.rate.pct)
  if (pct === 0) return 'at your rate'
  return `${pct > 0 ? '+' : '−'}${formatInr(Math.abs(deal.rate.deltaInr))} · ${Math.abs(pct)}% ${pct > 0 ? 'above' : 'under'}`
}

export const whenLabel = (deal: Deal, today: string) => deadlineLabel(deal.terms.deadline, today)

/** The same reading for one email, without pretending it is a full deal. */
export const deadlineLabel = (deadline: Deal['terms']['deadline'], today: string) => {
  const d = deadline
  if (d.date) {
    const days = daysBetween(today, d.date)
    const suffix = days < 0 ? `${Math.abs(days)}d late` : days === 0 ? 'today' : `in ${days}d`
    return { date: shortDate(d.date), suffix, late: days < 0 }
  }
  if (d.relative) return { date: d.relative.replace(/^within\s+/, ''), suffix: '', late: false }
  return { date: 'No date', suffix: '', late: false }
}

export const receivedLabel = (iso: string) => {
  const date = iso.slice(0, 10)
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
}

export const receivedTime = (iso: string) => iso.slice(11, 16)

export const platformLabel = (platform: Deal['terms']['platform']) => {
  if (platform === 'both') return 'Instagram + YouTube'
  if (platform === 'instagram') return 'Instagram'
  if (platform === 'youtube') return 'YouTube'
  return 'Not stated'
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const usageText = (usage: Deal['terms']['usage']) => {
  const parts: string[] = []
  if (usage.perpetual) parts.push('Perpetual usage')
  else if (usage.months) parts.push(`${usage.months} months paid usage`)
  if (usage.paidAds) parts.push('paid ads')
  if (usage.whitelisting) parts.push('whitelisting')
  return parts.length ? parts.join(' · ') : null
}

/** The brand's initials, for a header or an empty avatar. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

/** A flat list of the categories in inbox order, for strips and legends. */
export const CATEGORY_ORDER = ['deal_offer', 'needs_more_info', 'not_a_fit', 'scam_or_phishing', 'spam'] as const
