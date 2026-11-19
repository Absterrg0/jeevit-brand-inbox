/**
 * Turn one validated model extraction into facts the rest of the code can trust:
 * parsed money, a resolved date, and only those conflict/red-flag claims whose
 * quoted evidence is really in the email.
 */
import type { CheckResult } from '../llm/check'
import type { Email, Extraction, Profile, RedFlagType, Signal, Terms } from '../types'
import { brandKey, domainKey } from './brand'
import { resolveDate } from './dates'
import { backstopSignals, looksLikePaymentDemand, quoteIsGrounded } from './evidence'
import { parseMoney } from './money'
import type { Policy } from './profile'

/** A scam can be established by any one of these. Everything else is only a warning. */
export const HARD_SIGNALS: ReadonlySet<RedFlagType> = new Set(['upfront_payment', 'credential_or_verification_link', 'instructions_to_ai'])

/** A "log in / verify" claim needs at least a link or those words somewhere in the email. */
const LOGIN_BAIT = /https?:\/\/|www\.|\b(verify|verification|log ?in|sign ?in|password|confirm your (account|login|identity))\b/i

export interface EmailFacts {
  email: Email
  extraction: Extraction | null
  promotes: string | null
  /** False when the rule check was needed but did not produce a valid answer. */
  rulesChecked: boolean
  /** Partial terms stated in this one email. Merged across the thread in deals.ts. */
  terms: Partial<Terms>
  signals: Signal[]
  isScam: boolean
  ruleConflicts: { rule: number; quote: string }[]
  exclusivityConflicts: { index: number; quote: string }[]
  /** Things the model said "yes" to without evidence that is in the email. */
  unverified: string[]
  key: string
  droppedClaims: string[]
}

export function buildFacts(email: Email, extraction: Extraction | null, profile: Profile, policy: Policy, check: CheckResult | null = null): EmailFacts {
  const source = `${email.subject}\n${email.body}`
  const droppedClaims: string[] = []
  const signals: Signal[] = backstopSignals(email)
  const ruleConflicts: EmailFacts['ruleConflicts'] = []
  const exclusivityConflicts: EmailFacts['exclusivityConflicts'] = []
  const terms: Partial<Terms> = {}
  const unverified: string[] = []

  if (extraction) {
    for (const flag of extraction.red_flags) {
      if (!quoteIsGrounded(flag.quote, source)) droppedClaims.push(`red flag ${flag.type}: quote not found in email ("${flag.quote}")`)
      else if (flag.type === 'credential_or_verification_link' && !LOGIN_BAIT.test(source)) droppedClaims.push('red flag credential_or_verification_link: the email has no link and no request to log in or verify')
      else if (!signals.some((s) => s.type === flag.type)) signals.push({ type: flag.type, quote: flag.quote, source: 'model' })
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

  // Answers from the check call: "S0" is the pay-to-take-part question, "R0" is content rule 0,
  // "X0" is exclusivity 0. A "yes" only counts with words from the email behind it.
  for (const a of check?.answers.filter((x) => x.answer) ?? []) {
    const m = /^([SRX])(\d+)$/.exec(a.id.trim().toUpperCase())
    const index = m ? Number(m[2]) : -1
    const subject = !m ? null : m[1] === 'S' ? (index === 0 ? 'a request for you to pay' : null) : m[1] === 'R' ? profile.content_rules[index] : profile.current_exclusivity[index] && `your ${profile.current_exclusivity[index].brand} exclusivity`
    if (!m || !subject) droppedClaims.push(`check "${a.id}": no such question`)
    else if (!a.evidence || !quoteIsGrounded(a.evidence, source)) {
      // The model said "yes" but could not point at the words. Believing it risks declining a good
      // deal on a hallucination; ignoring it risks accepting a bad one. So neither: a person looks.
      unverified.push(subject)
      droppedClaims.push(`check ${a.id}: answered yes, but the evidence is not in the email ("${a.evidence ?? ''}")`)
    } else if (m[1] === 'S') {
      if (looksLikePaymentDemand(a.evidence)) signals.push({ type: 'upfront_payment', quote: a.evidence, source: 'model' })
      else droppedClaims.push(`check S0: "${a.evidence}" is in the email but is not a demand for payment`)
    } else if (m[1] === 'R') ruleConflicts.push({ rule: index, quote: a.evidence })
    else exclusivityConflicts.push({ index, quote: a.evidence })
  }

  return {
    email,
    extraction,
    promotes: check?.promotes ?? null,
    rulesChecked: check !== null,
    terms,
    signals,
    // A lookalike platform domain is found by code, so it counts as hard evidence; the
    // model's own "impersonation" hunch does not.
    isScam: signals.some((s) => HARD_SIGNALS.has(s.type) || (s.type === 'impersonation' && s.source === 'code')),
    ruleConflicts,
    exclusivityConflicts,
    unverified,
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
