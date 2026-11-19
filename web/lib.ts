import type { Action, Deal, Terms } from '../src/types'

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export const money = (amount: number, currency: string) => (currency === 'USD' ? `$${amount.toLocaleString('en-US')}` : inr(amount))

export function offerText(terms: Terms): string | null {
  if (terms.fee) return money(terms.fee.amount, terms.fee.currency)
  if (terms.giftValue) return `Gift, ${inr(terms.giftValue.inr)}`
  if (terms.paymentType === 'gifting') return 'Gifting only'
  if (terms.paymentType === 'commission_only') return 'Commission only'
  return null
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

export function longDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function due(today: string, deal: Deal): { date: string; note: string; late: boolean } | null {
  const date = deal.terms.deadline?.date
  if (!date) return null
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
  if (days < 0) return { date: shortDate(date), note: 'passed', late: true }
  return { date: shortDate(date), note: days === 0 ? 'today' : `in ${days} days`, late: false }
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']
export const word = (n: number) => WORDS[n] ?? String(n)

export const ACTION_WORD: Record<Action, string> = {
  accept: 'Accept',
  negotiate: 'Negotiate',
  ask_for_details: 'Ask for details',
  review_manually: 'Read it yourself',
  decline: 'Decline',
  report: 'Report',
  ignore: 'Ignore',
}

export const GROUPS: { key: string; title: string; note: string; actions: Action[] }[] = [
  { key: 'reply', title: 'Reply today', note: 'A draft is ready for each', actions: ['accept', 'negotiate', 'ask_for_details', 'review_manually'] },
  { key: 'decline', title: 'Turn down', note: 'Politely, with a draft', actions: ['decline'] },
  { key: 'report', title: 'Scams', note: 'Do not reply, pay or click', actions: ['report'] },
  { key: 'ignore', title: 'Nothing to do', note: 'Not a brand offer', actions: ['ignore'] },
]

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers and non-secure origins: fall back to a hidden textarea.
    const area = document.createElement('textarea')
    area.value = text
    area.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}
