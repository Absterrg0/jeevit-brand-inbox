/**
 * Emails → deals. Grouping, "latest terms win", and the category are all plain
 * code, so the same inputs always give the same deal.
 */
import type { Category, Deal, Terms } from '../types'
import { domainKey, threadSubject } from './brand'
import type { EmailFacts } from './facts'
import { formatMoney } from './money'

export const EMPTY_TERMS: Terms = {
  product: null,
  deliverables: [],
  paymentType: 'not_stated',
  fee: null,
  giftValue: null,
  deadline: null,
  usage: null,
  otherTerms: [],
}

/** Emails that must never be merged into a deal: a scam cannot rewrite a real brand's terms. */
const standsAlone = (f: EmailFacts) => f.isScam || !f.extraction || f.extraction.email_kind !== 'brand_outreach'

function sameDeal(a: EmailFacts, b: EmailFacts): boolean {
  if (a.key === b.key) return true
  // "dewlab" vs "dewlabskincare": the model does not always name a brand the same way twice.
  const [short, long] = a.key.length <= b.key.length ? [a.key, b.key] : [b.key, a.key]
  if (short.length >= 5 && long.startsWith(short)) return true
  // A reply in the same thread from the same address, even if the model found no brand in it.
  return a.email.from.toLowerCase() === b.email.from.toLowerCase() && threadSubject(a.email.subject) === threadSubject(b.email.subject)
}

/** Groups in order of first email; each group oldest → newest. */
export function groupEmails(facts: EmailFacts[]): EmailFacts[][] {
  const sorted = [...facts].sort((a, b) => a.email.received_at.localeCompare(b.email.received_at) || a.email.id.localeCompare(b.email.id))
  const groups: EmailFacts[][] = []
  for (const f of sorted) {
    const home = standsAlone(f) ? undefined : groups.find((g) => !standsAlone(g[0]) && g.some((other) => sameDeal(other, f)))
    if (home) home.push(f)
    else groups.push([f])
  }
  return groups
}

const describeDeliverables = (d: Terms['deliverables']) => d.map((x) => `${x.count} × ${x.type.replace(/_/g, ' ')}`).join(', ')

/**
 * Field by field, the newest email that states a value wins. A follow-up that
 * only changes the fee keeps the deliverables and usage from the first email.
 */
export function mergeTerms(group: EmailFacts[]): { terms: Terms; history: Deal['history'] } {
  const terms: Terms = { ...EMPTY_TERMS, otherTerms: [] }
  const history: Deal['history'] = []
  const note = (emailId: string, field: string, from: string, to: string) => {
    if (from !== to) history.push({ emailId, field, from, to })
  }

  for (const f of group) {
    const t = f.terms
    const id = f.email.id
    if (t.product) terms.product = t.product
    if (t.deliverables?.length) {
      if (terms.deliverables.length) note(id, 'deliverables', describeDeliverables(terms.deliverables), describeDeliverables(t.deliverables))
      terms.deliverables = t.deliverables
    }
    if (t.paymentType) terms.paymentType = t.paymentType
    if (t.fee) {
      if (terms.fee) note(id, 'fee', formatMoney(terms.fee.amount, terms.fee.currency), formatMoney(t.fee.amount, t.fee.currency))
      terms.fee = t.fee
    }
    if (t.giftValue) terms.giftValue = t.giftValue
    if (t.deadline) {
      if (terms.deadline?.date && t.deadline.date) note(id, 'deadline', terms.deadline.date, t.deadline.date)
      terms.deadline = t.deadline
    }
    if (t.usage) terms.usage = t.usage
    for (const o of t.otherTerms ?? []) if (!terms.otherTerms.includes(o) && terms.otherTerms.length < 6) terms.otherTerms.push(o)
  }
  return { terms, history }
}

export const hasCompensation = (t: Terms) =>
  Boolean(t.fee) || Boolean(t.giftValue) || t.paymentType === 'gifting' || t.paymentType === 'cash_and_gifting' || t.paymentType === 'commission_only'

/**
 * The category is decided here, from verified facts, in a fixed order.
 * The model's `suggested_category` is not an input.
 */
export function categorise(
  latest: EmailFacts,
  thread: EmailFacts[],
  terms: Terms,
  blocked: { rule: boolean; exclusivity: boolean },
): { category: Category; reason: string } {
  if (latest.isScam) {
    const s = latest.signals.find((x) => x.source === 'code') ?? latest.signals[0]
    return { category: 'scam_or_phishing', reason: `Scam signal: ${s.type.replace(/_/g, ' ')} ("${s.quote}").` }
  }
  if (!latest.extraction) return { category: 'needs_more_info', reason: 'The model output could not be validated, so this email was not analysed.' }
  if (latest.extraction.email_kind !== 'brand_outreach') {
    return { category: 'spam', reason: `Not a brand offer (${latest.extraction.email_kind.replace(/_/g, ' ')}).` }
  }
  if (blocked.rule) return { category: 'not_a_fit', reason: 'Breaks one of your content rules.' }
  if (blocked.exclusivity) return { category: 'not_a_fit', reason: 'Conflicts with a current exclusivity.' }
  if (terms.deliverables.length && hasCompensation(terms)) {
    return { category: 'deal_offer', reason: `States deliverables and compensation${thread.length > 1 ? ' across the thread' : ''}.` }
  }
  const missing = [!terms.deliverables.length && 'deliverables', !hasCompensation(terms) && 'fee'].filter(Boolean)
  return { category: 'needs_more_info', reason: `Looks like real outreach, but no ${missing.join(' or ')} stated.` }
}

/** The address the creator should reply to: the brand's own domain if it wrote, else the latest sender. */
export function pickContact(group: EmailFacts[]): Deal['contact'] {
  const latest = group[group.length - 1]
  return {
    name: latest.extraction?.sender_name ?? null,
    email: latest.email.from,
    org: latest.extraction?.sender_org ?? null,
  }
}

/** True when a later email comes from a different organisation's domain than the first. */
export function thirdPartySender(group: EmailFacts[]): EmailFacts | null {
  const first = domainKey(group[0].email.from) ?? group[0].email.from
  return group.slice(1).find((f) => (domainKey(f.email.from) ?? f.email.from) !== first) ?? null
}
