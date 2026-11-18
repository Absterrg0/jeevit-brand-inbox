/**
 * Text parsing. Everything here is plain string work on purpose: money, dates
 * and deliverable counts must be exact and reproducible, and a language model
 * is the wrong tool for an invoice field. Email bodies are treated as data
 * only — no instruction inside one is ever executed.
 */
import type { Deadline, Deliverable, Money, Usage } from './types'

export const normalize = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
export const lower = (s: string) => normalize(s).toLowerCase()

export function sentenceWith(text: string, pattern: RegExp): string | null {
  const sentences = normalize(text).split(/(?<=[.!?])\s+/)
  return sentences.find((s) => pattern.test(s)) ?? null
}

export function titleCase(s: string) {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

// ── Numbers ─────────────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  ek: 1,
  do: 2,
  teen: 3,
  chaar: 4,
  paanch: 5,
}

export const count = (raw: string): number => {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : (NUMBER_WORDS[raw.toLowerCase()] ?? 1)
}

const MULTIPLIER: Record<string, number> = { k: 1_000, thousand: 1_000, lakh: 100_000, lac: 100_000, cr: 10_000_000, crore: 10_000_000 }

export interface MoneyMention extends Money {
  index: number
  raw: string
}

/**
 * Every money mention in the body, with the local wording used to tell an
 * offer from a gift value or a registration fee. Indian digit grouping
 * ("1,20,000") is handled by stripping commas before parsing.
 */
export function moneyMentions(text: string): MoneyMention[] {
  const source = normalize(text)
  const found: MoneyMention[] = []
  const seen = new Set<number>()
  const context = (index: number) => lower(source.slice(Math.max(0, index - 48), index + 52))
  const kindFor = (index: number): Money['basis'] | 'registration' | 'gift' => {
    const around = context(index)
    if (/registration|joining fee|one-time fee|entry fee/.test(around)) return 'registration'
    if (/worth|valued|value of|free products|gift(?:ed)?\b/.test(around)) return 'gift'
    return 'cash'
  }

  const push = (raw: string, amountText: string, currency: 'INR' | 'USD', mult: string | undefined, index: number) => {
    if (seen.has(index)) return
    seen.add(index)
    const amount = count(amountText) * (mult ? (MULTIPLIER[mult.toLowerCase()] ?? 1) : 1)
    if (!amount) return
    const inr = currency === 'USD' ? Math.round(amount * 84) : Math.round(amount)
    const kind = kindFor(index)
    found.push({
      amount,
      currency,
      inr,
      basis: kind === 'cash' ? 'cash' : 'gifting',
      quote: normalize(raw).replace(/,$/, ''),
      index,
      raw: raw.trim(),
    })
  }

  for (const m of source.matchAll(/\b(?:inr|rs\.?|₹)\s*([\d][\d,]*(?:\.\d+)?)\s*(k|lakh|lac|cr|crore)?\b/gi)) {
    push(m[0], m[1], 'INR', m[2], m.index ?? 0)
  }
  for (const m of source.matchAll(/\b(?:usd|us\$|\$)\s*([\d][\d,]*(?:\.\d+)?)\b/gi)) {
    push(m[0], m[1], 'USD', undefined, m.index ?? 0)
  }
  for (const m of source.matchAll(/\b([\d][\d,]*(?:\.\d+)?)\s*(usd|dollars?)\b/gi)) {
    push(m[0], m[1], 'USD', undefined, m.index ?? 0)
  }
  // Bare "25k" or "3 lakh", only where no currency symbol already claimed that spot.
  for (const m of source.matchAll(/\b([\d][\d,]*(?:\.\d+)?)\s*(k|lakh|lac|crore)\b/gi)) {
    push(m[0], m[1], 'INR', m[2], m.index ?? 0)
  }

  return found.sort((a, b) => a.index - b.index)
}

/** The best fee on the table: a cash offer, else a gift value, else nothing. */
export function bestMoney(text: string): Money | null {
  const mentions = moneyMentions(text)
  const offer = mentions.find((m) => m.basis === 'cash' && !isRegistrationFee(text, m))
  if (offer) return stripMention(offer)
  const gift = mentions.find((m) => m.basis === 'gifting' && !isRegistrationFee(text, m))
  if (gift) return stripMention({ ...gift, basis: 'gifting' })
  return null
}

function isRegistrationFee(text: string, m: MoneyMention) {
  const around = lower(text.slice(Math.max(0, m.index - 60), m.index + 60))
  return /registration|joining fee|one-time fee/.test(around)
}

const stripMention = (m: MoneyMention): Money => ({
  amount: m.amount,
  currency: m.currency,
  inr: m.inr,
  basis: m.basis,
  quote: m.quote,
})

export function registrationFee(text: string): number | null {
  const m = moneyMentions(text).find((x) => isRegistrationFee(text, x))
  return m ? m.inr : null
}

export function giftValue(text: string): number | null {
  const m = moneyMentions(text).find((x) => /worth|valued|value of/.test(lower(text.slice(Math.max(0, x.index - 40), x.index + 40))))
  return m ? m.inr : null
}

// ── Deliverables ────────────────────────────────────────────────────────────

const N = '\\d+|one|two|three|four|five|six|a|an|ek|do|teen|chaar|paanch'

export function parseDeliverables(raw: string): Deliverable[] {
  const t = lower(raw)
  const out = new Map<Deliverable['kind'], number>()
  const add = (kind: Deliverable['kind'], qty: number) => out.set(kind, Math.max(out.get(kind) ?? 0, qty))

  for (const m of t.matchAll(new RegExp(`\\b(${N})\\s+(?:(?:instagram|ig|insta)\\s+)?reels?\\b`, 'gi'))) add('instagram_reel', count(m[1]))
  for (const m of t.matchAll(new RegExp(`\\b(${N})\\s+(?:(?:instagram|ig|insta)\\s+)?stories\\b`, 'gi'))) add('instagram_story', count(m[1]))
  if (/youtube/.test(t) && /integration/.test(t)) add('youtube_integration', 1)
  if (/youtube/.test(t) && /dedicated video/.test(t)) add('youtube_dedicated_video', 1)
  if (/youtube[^.]{0,30}shout ?out|shout ?out/.test(t)) add('youtube_shoutout', 1)

  return [...out].map(([kind, qty]) => ({ kind, qty }))
}

export function platformOf(deliverables: Deliverable[]): 'instagram' | 'youtube' | 'both' | null {
  const hasIg = deliverables.some((d) => d.kind.startsWith('instagram_'))
  const hasYt = deliverables.some((d) => d.kind.startsWith('youtube_'))
  if (hasIg && hasYt) return 'both'
  if (hasIg) return 'instagram'
  if (hasYt) return 'youtube'
  return null
}

// ── Dates ───────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
}

const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function yearFor(month: number, receivedAt: string) {
  const received = Number(receivedAt.slice(0, 4))
  const receivedMonth = Number(receivedAt.slice(5, 7))
  // A brief that names January arrives in November: it means next year.
  return month < receivedMonth - 6 ? received + 1 : received
}

const shiftDay = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function parseDeadline(raw: string, receivedAt: string): Deadline {
  const t = normalize(raw)
  const relative = t.match(/within\s+(\d+)\s+weeks?\s+of\s+delivery/i)
  if (relative) {
    return { date: null, relative: normalize(relative[0]).toLowerCase(), window: null, raw: normalize(relative[0]) }
  }

  const between = t.match(new RegExp(`between\\s+(\\d{1,2})\\s+(?:and|–|-|to)\\s+(\\d{1,2})\\s+(${MONTH_RE})`, 'i'))
  if (between) {
    const m = MONTHS[between[3].toLowerCase().slice(0, 3)] ?? MONTHS[between[3].toLowerCase()]
    const y = yearFor(m, receivedAt)
    return {
      date: iso(y, m, Number(between[2])),
      relative: null,
      window: { start: iso(y, m, Number(between[1])), end: iso(y, m, Number(between[2])) },
      raw: normalize(between[0]),
    }
  }

  const range = t.match(new RegExp(`(\\d{1,2})\\s*[–-]\\s*(\\d{1,2})\\s+(${MONTH_RE})`, 'i'))
  if (range) {
    const m = MONTHS[range[3].toLowerCase().slice(0, 3)] ?? MONTHS[range[3].toLowerCase()]
    const y = yearFor(m, receivedAt)
    return {
      date: iso(y, m, Number(range[2])),
      relative: null,
      window: { start: iso(y, m, Number(range[1])), end: iso(y, m, Number(range[2])) },
      raw: normalize(range[0]),
    }
  }

  const dayFirst = t.match(new RegExp(`(?:by|before|until|live|deadline(?:\\s+is)?|due|from)\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`, 'i'))
  if (dayFirst) {
    const m = MONTHS[dayFirst[2].toLowerCase().slice(0, 3)] ?? MONTHS[dayFirst[2].toLowerCase()]
    const y = dayFirst[3] ? Number(dayFirst[3]) : yearFor(m, receivedAt)
    const date = iso(y, m, Number(dayFirst[1]))
    // "before 10 December" is a 9 December deadline, not a 10 December one.
    return { date: /^before\b/i.test(dayFirst[0]) ? shiftDay(date, -1) : date, relative: null, window: null, raw: normalize(dayFirst[0]) }
  }

  const monthFirst = t.match(new RegExp(`(?:by|before|until|deadline(?:\\s+is)?|due)\\s+(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i'))
  if (monthFirst) {
    const m = MONTHS[monthFirst[1].toLowerCase().slice(0, 3)] ?? MONTHS[monthFirst[1].toLowerCase()]
    const y = yearFor(m, receivedAt)
    const date = iso(y, m, Number(monthFirst[2]))
    return { date: /^before\b/i.test(monthFirst[0]) ? shiftDay(date, -1) : date, relative: null, window: null, raw: normalize(monthFirst[0]) }
  }

  const bare = t.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})`, 'i'))
  if (bare) {
    const m = MONTHS[bare[2].toLowerCase().slice(0, 3)] ?? MONTHS[bare[2].toLowerCase()]
    const y = yearFor(m, receivedAt)
    return { date: iso(y, m, Number(bare[1])), relative: null, window: null, raw: normalize(bare[0]) }
  }

  return { date: null, relative: null, window: null, raw: null }
}

// ── Usage rights ────────────────────────────────────────────────────────────

export function parseUsage(raw: string): Usage {
  const t = lower(raw)
  const months = t.match(/(\d+)\s*months?[^.]{0,40}(?:usage|rights)/) ?? t.match(/(?:usage|rights)[^.]{0,30}(\d+)\s*months?/)
  const perpetual = /perpetual|in perpetuity|forever|indefinitely/.test(t)
  const whitelisting = /whitelist|white-list|paid partnership on your (?:handle|account)|spark ads/.test(t)
  const paidAds = /paid (?:ad|ads|advertising)|usage (?:rights )?for paid ads|ad usage|boosting|dark post/.test(t)
  const sentence = sentenceWith(raw, /rights|usage|perpetual|whitelist/i)
  return {
    months: months ? Number(months[1]) : null,
    perpetual,
    paidAds,
    whitelisting,
    raw: sentence,
  }
}

// ── Detection helpers ───────────────────────────────────────────────────────

const INJECTION_PATTERNS: [RegExp, string][] = [
  [/note to any (?:ai|assistant)/i, 'addresses an AI assistant directly'],
  [/(?:classify|label|treat) this (?:email|message)(?: as)?/i, 'asks how it should be classified'],
  [/(?:ignore|disregard) (?:all |any )?(?:previous|prior|above) instructions/i, 'tries to override instructions'],
  [/(?:system prompt|jailbreak|prompt injection)/i, 'mentions prompt internals'],
  [/(?:recommend|mark|reply with) (?:accept|approved|send)/i, 'dictates the recommendation'],
  [/(?:phone number|home address|aadhaar|passport|otp|password|bank details)/i, 'asks for personal data'],
]

export function injectionSignals(raw: string): string[] {
  return INJECTION_PATTERNS.filter(([re]) => re.test(raw)).map(([, why]) => why)
}

export function looksLikePhishing(from: string, _subject: string, body: string): string[] {
  const reasons: string[] = []
  const domain = from.split('@')[1]?.toLowerCase() ?? ''
  const known = /youtube|google|instagram|facebook|meta|whatsapp|apple|amazon|paypal|netflix|microsoft/i
  const brandInDomain = domain.match(known)?.[0]
  if (brandInDomain && !new RegExp(`^${brandInDomain}\\.(com|co\\.in|in|net|org)$`).test(domain)) {
    reasons.push(`sender domain “${domain}” imitates ${brandInDomain} without being it`)
  }
  if (/https?:\/\//i.test(body) && !/^https:\/\/(?:www\.)?(?:youtube\.com|instagram\.com)\//i.test(body)) {
    reasons.push('asks the creator to “verify” through a link that is not the platform’s own domain')
  }
  if (/(?:account|channel)[^.]{0,40}(?:suspended|terminated|locked|disabled)/i.test(body)) {
    reasons.push('threatens suspension to force a fast click')
  }
  if (/copyright strikes?/i.test(body) && /verify/i.test(body)) reasons.push('uses a plausible platform penalty as bait')
  if (/verify your account|confirm your (?:password|details)|login to continue/i.test(body)) reasons.push('asks for account credentials')
  if (!reasons.length) return []
  if (/24 hours|within 24 hours|today only|expires? (?:today|tonight)/i.test(body)) reasons.push('sets a hard deadline measured in hours')
  return reasons
}

export function isNewsletter(subject: string, body: string): boolean {
  const t = lower(`${subject} ${body}`)
  return /unsubscribe/.test(t) && !/reel|stories|integration|shout ?out|deliverable|collab|interested|offer|proposal|brief/.test(t)
}

export function prohibitedCategory(raw: string): string | null {
  const t = lower(raw)
  if (/\b(?:gambling|betting|casino|sportsbook|fantasy (?:cricket|sports)|rummy|teen patti|lottery|satta)\b/.test(t)) return 'gambling or fantasy sports'
  if (/\b(?:crypto|cryptocurrency|bitcoin|web3 token|trading tips?|forex signals?|stock tips?|nft drop)\b/.test(t)) return 'crypto or trading advice'
  return null
}

export function mentionsSmartphone(raw: string): boolean {
  return /\b(?:smartphone|smart phone|handset|phone launch|flagship phone)\b/i.test(raw)
}

export function mentionedAttachment(raw: string): boolean {
  return /\b(?:brief|deck|media kit|documents?)\s+(?:is\s+)?attached|attached (?:brief|deck|pdf)|please find .{0,30}attached/i.test(raw)
}

export function formatInr(n: number): string {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))}`
}

export function formatUsd(n: number): string {
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n))}`
}

export function shortInr(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2).replace(/\.00$/, '')} Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2).replace(/\.?0+$/, '')} L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `₹${n}`
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
}

export function weekdayDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const weekday = d.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long' })
  return `${weekday} ${longDate(date)}`
}

export function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
}
