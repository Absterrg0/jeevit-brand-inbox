import { useEffect, useState } from 'react'
import type { Deal, Terms } from '../src/types'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export const money = (amount: number, currency: string) => (currency === 'USD' ? `$${amount.toLocaleString('en-US')}` : inr(amount))

export function offerText(terms: Terms): string {
  if (terms.fee) return money(terms.fee.amount, terms.fee.currency)
  if (terms.giftValue) return `Gift worth ${inr(terms.giftValue.inr)}`
  if (terms.paymentType === 'gifting') return 'Gifting only'
  return 'No fee stated'
}

const SHORT: Record<string, [string, string]> = {
  instagram_reel: ['reel', 'reels'],
  instagram_story: ['story', 'stories'],
  instagram_post: ['post', 'posts'],
  youtube_integration: ['YouTube integration', 'YouTube integrations'],
  youtube_dedicated_video: ['YouTube video', 'YouTube videos'],
  youtube_short: ['Short', 'Shorts'],
  other: ['other item', 'other items'],
}

export function scopeText(terms: Terms): string | null {
  if (!terms.deliverables.length) return null
  return terms.deliverables.map((d) => `${d.count} ${SHORT[d.type][d.count === 1 ? 0 : 1]}`).join(' + ')
}

export function shortDate(iso: string, withYear = false): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' })
}

export function daysUntil(today: string, iso: string): number {
  return Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000)
}

export function dueText(today: string, deal: Deal): { text: string; urgent: boolean } | null {
  const date = deal.terms.deadline?.date
  if (!date) return deal.terms.deadline?.text ? { text: deal.terms.deadline.text, urgent: false } : null
  const days = daysUntil(today, date)
  if (days < 0) return { text: `${shortDate(date)}, already passed`, urgent: true }
  return { text: `${shortDate(date, !date.startsWith(today.slice(0, 4)))} · ${days === 0 ? 'today' : `${days}d`}`, urgent: days < 5 }
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('winnow-theme', dark ? 'dark' : 'light')
    } catch {
      /* private mode: the choice just does not persist */
    }
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}
