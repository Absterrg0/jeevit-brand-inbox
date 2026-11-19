/**
 * Turn one validated model extraction into facts the rest of the code can trust:
 * parsed money, a resolved date, and only those conflict/red-flag claims whose
 * quoted evidence is really in the email.
 */
import type { Email, Extraction, Profile, RedFlagType, Signal, Terms } from '../types'
import { brandKey, domainKey } from './brand'
import { resolveDate } from './dates'
import { backstopSignals, quoteIsGrounded } from './evidence'
import { parseMoney } from './money'
import type { Policy } from './profile'

/** A scam can be established by any one of these. Everything else is only a warning. */
export const HARD_SIGNALS: ReadonlySet<RedFlagType> = new Set(['upfront_payment', 'credential_or_verification_link', 'instructions_to_ai'])

export interface EmailFacts {
  email: Email
  extraction: Extraction | null
  /** Partial terms stated in this one email. Merged across the thread in deals.ts. */
  terms: Partial<Terms>
  signals: Signal[]
  isScam: boolean
  ruleConflicts: { rule: number; quote: string }[]
  exclusivityConflicts: { index: number; quote: string }[]
  key: string
  droppedClaims: string[]
}

export function buildFacts(email: Email, extraction: Extraction | null, profile: Profile, policy: Policy): EmailFacts {
  const source = `${email.subject}\n${email.body}`
  const droppedClaims: string[] = []
  const signals: Signal[] = backstopSignals(email)
  const ruleConflicts: EmailFacts['ruleConflicts'] = []
  const exclusivityConflicts: EmailFacts['exclusivityConflicts'] = []
  const terms: Partial<Terms> = {}

  if (extraction) {
    for (const flag of extraction.red_flags) {
      if (!quoteIsGrounded(flag.quote, source)) droppedClaims.push(`red flag ${flag.type}: quote not found in email ("${flag.quote}")`)
      else if (!signals.some((s) => s.type === flag.type)) signals.push({ type: flag.type, quote: flag.quote, source: 'model' })
    }
    for (const c of extraction.rule_conflicts) {
      if (!profile.content_rules[c.rule]) droppedClaims.push(`rule conflict: no rule #${c.rule}`)
      else if (!quoteIsGrounded(c.quote, source)) droppedClaims.push(`rule conflict #${c.rule}: quote not found in email ("${c.quote}")`)
      else if (!ruleConflicts.some((r) => r.rule === c.rule)) ruleConflicts.push({ rule: c.rule, quote: c.quote })
    }
    for (const c of extraction.exclusivity_conflicts) {
      if (!profile.current_exclusivity[c.exclusivity]) droppedClaims.push(`exclusivity conflict: no entry #${c.exclusivity}`)
      else if (!quoteIsGrounded(c.quote, source)) droppedClaims.push(`exclusivity conflict #${c.exclusivity}: quote not found in email ("${c.quote}")`)
      else if (!exclusivityConflicts.some((r) => r.index === c.exclusivity)) exclusivityConflicts.push({ index: c.exclusivity, quote: c.quote })
    }

    if (extraction.product) terms.product = extraction.product
    if (extraction.deliverables.length) terms.deliverables = mergeSameType(extraction.deliverables)
    if (extraction.payment_type !== 'not_stated') terms.paymentType = extraction.payment_type
    const fee = parseMoney(extraction.fee_text, policy.usdToInr)
    if (fee) terms.fee = fee
    const gift = parseMoney(extraction.gift_value_text, policy.usdToInr)
    if (gift) terms.giftValue = gift
    if (extraction.deadline && (extraction.deadline.text || extraction.deadline.day)) {
      terms.deadline = { date: resolveDate(extraction.deadline, email.received_at), text: extraction.deadline.text }
    }
    const u = extraction.usage_rights
    if (u && (u.text || u.months !== null || u.perpetual || u.whitelisting)) {
      terms.usage = { text: u.text, months: u.perpetual ? null : u.months, perpetual: u.perpetual, paidAds: u.paid_ads, whitelisting: u.whitelisting }
    }
    if (extraction.other_terms.length) terms.otherTerms = extraction.other_terms
  }

  return {
    email,
    extraction,
    terms,
    signals,
    // A lookalike platform domain is found by code, so it counts as hard evidence; the
    // model's own "impersonation" hunch does not.
    isScam: signals.some((s) => HARD_SIGNALS.has(s.type) || (s.type === 'impersonation' && s.source === 'code')),
    ruleConflicts,
    exclusivityConflicts,
    key: brandKey(extraction?.brand) ?? domainKey(email.from) ?? email.from.toLowerCase(),
    droppedClaims,
  }
}

function mergeSameType(items: Extraction['deliverables']) {
  const out: Extraction['deliverables'] = []
  for (const item of items) {
    const existing = out.find((o) => o.type === item.type && item.type !== 'other')
    if (existing) existing.count += item.count
    else out.push({ ...item })
  }
  return out
}
