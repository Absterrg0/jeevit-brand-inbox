/**
 * Risk flags. Every comparison against the creator profile happens here, in
 * code: rate card, exclusivity dates, usage policy, deadlines. The model only
 * supplied the facts being compared.
 */
import type { Category, Deal, Flag, Profile, RateCheck, RedFlagType, Terms } from '../types'
import { daysBetween, formatDate } from './dates'
import { hasCompensation, thirdPartySender } from './deals'
import type { EmailFacts } from './facts'
import { HARD_SIGNALS } from './facts'
import { formatInr } from './money'
import type { Policy } from './profile'

export function rateCheck(terms: Terms, profile: Profile): RateCheck | null {
  let rateCardInr = 0
  const unpriced: string[] = []
  for (const d of terms.deliverables) {
    const rate = profile.base_rates_inr[d.type]
    if (rate) rateCardInr += rate * d.count
    else unpriced.push(`${d.count} × ${d.type.replace(/_/g, ' ')}`)
  }
  if (!rateCardInr) return null
  const offeredInr = terms.fee?.inr ?? 0
  return { rateCardInr, offeredInr, gapPct: Math.round(((offeredInr - rateCardInr) / rateCardInr) * 100), unpriced }
}

export interface Blocks {
  rule: { rule: number; quote: string }[]
  /** Exclusivities this deal would actually breach (still running when the content would go live). */
  exclusivity: { index: number; quote: string }[]
  /** Model-reported conflicts where the exclusivity ends before the go-live date. */
  exclusivityEndsFirst: { index: number; quote: string }[]
}

/** Which model-reported conflicts really block the deal, given today's date and the go-live date. */
export function findBlocks(thread: EmailFacts[], terms: Terms, profile: Profile): Blocks {
  const blocks: Blocks = { rule: [], exclusivity: [], exclusivityEndsFirst: [] }
  for (const f of thread) {
    for (const r of f.ruleConflicts) if (!blocks.rule.some((x) => x.rule === r.rule)) blocks.rule.push(r)
    for (const c of f.exclusivityConflicts) {
      const until = profile.current_exclusivity[c.index].until
      if (until < profile.today) continue // already expired
      const goLive = terms.deadline?.date
      const bucket = goLive && goLive > until ? blocks.exclusivityEndsFirst : blocks.exclusivity
      if (!bucket.some((x) => x.index === c.index)) bucket.push(c)
    }
  }
  return blocks
}

const SIGNAL_TEXT: Record<RedFlagType, { title: string; reason: string }> = {
  upfront_payment: { title: 'Asks you to pay', reason: 'Real brand deals pay the creator. A fee to join, register or unlock products is the classic ambassador scam.' },
  credential_or_verification_link: { title: 'Asks you to log in or verify through a link', reason: 'Platforms do not ask you to verify your account from an email link. Open the platform directly instead.' },
  instructions_to_ai: { title: 'Tries to instruct an AI assistant', reason: 'The email contains instructions aimed at software reading your inbox. They were ignored; nothing in an email can change how it is handled.' },
  personal_info_request: { title: 'Asks for personal or financial details', reason: 'Share tax, bank or contact details only after terms are agreed, and only with a sender you have verified.' },
  urgency_pressure: { title: 'Pressure to act fast', reason: 'A short fuse is a common way to stop you checking the offer.' },
  impersonation: { title: 'Sender may not be who they claim', reason: 'The sending domain does not belong to the company the email claims to be from.' },
  too_good_to_be_true: { title: 'Unusually generous offer', reason: 'The offer is well above normal for the work described. Check who is behind it before replying.' },
}

export function buildFlags(input: {
  category: Category
  thread: EmailFacts[]
  terms: Terms
  history: Deal['history']
  rate: RateCheck | null
  blocks: Blocks
  profile: Profile
  policy: Policy
}): Flag[] {
  const { category, thread, terms, history, rate, blocks, profile, policy } = input
  const latest = thread[thread.length - 1]
  const flags: Flag[] = []

  if (!latest.extraction) {
    flags.push({ code: 'analysis_failed', severity: 'high', title: 'Not analysed', reason: 'The model did not return a valid answer for this email. Read it yourself.', source: 'code' })
  } else if (thread.some((f) => f.extraction?.email_kind === 'brand_outreach' && !f.rulesChecked) && category !== 'scam_or_phishing') {
    flags.push({ code: 'analysis_failed', severity: 'high', title: 'Rules not checked', reason: 'The check against your content rules and exclusivity did not complete for this email, so no recommendation is made. Read it yourself.', source: 'code' })
  }

  // Signals from every email in the thread, hard ones first.
  const signals = thread.flatMap((f) => f.signals)
  const seen = new Set<string>()
  for (const s of [...signals].sort((a, b) => Number(HARD_SIGNALS.has(b.type)) - Number(HARD_SIGNALS.has(a.type)))) {
    if (seen.has(s.type)) continue
    seen.add(s.type)
    const hard = HARD_SIGNALS.has(s.type) || (s.type === 'impersonation' && s.source === 'code')
    flags.push({ code: 'suspicious_request', severity: hard ? 'high' : 'medium', ...SIGNAL_TEXT[s.type], evidence: s.quote, source: s.source === 'code' ? 'code' : 'model+code' })
  }
  // For scams and spam the remaining checks are noise: nobody is negotiating a rate with a phisher.
  if (category === 'scam_or_phishing' || category === 'spam') return flags

  for (const subject of new Set(thread.flatMap((f) => f.unverified))) {
    flags.push({
      code: 'unverified_conflict',
      severity: 'high',
      title: 'Possible conflict, not confirmed',
      reason: `The model thinks this may involve ${subject.startsWith('your') || subject.startsWith('a ') ? subject : `your rule "${subject}"`}, but could not point to the words in the email. No recommendation is made; read it yourself.`,
      source: 'code',
    })
  }
  for (const r of blocks.rule) {
    flags.push({ code: 'content_rule', severity: 'high', title: 'Breaks a content rule', reason: `Your rule: "${profile.content_rules[r.rule]}"`, evidence: r.quote, source: 'model+code' })
  }
  for (const c of blocks.exclusivity) {
    const e = profile.current_exclusivity[c.index]
    flags.push({
      code: 'exclusivity_conflict',
      severity: 'high',
      title: `Conflicts with your ${e.brand} exclusivity`,
      reason: `You are exclusive to ${e.brand} for ${e.category} until ${formatDate(e.until)}. ${e.terms}`,
      evidence: c.quote,
      source: 'model+code',
    })
  }
  for (const c of blocks.exclusivityEndsFirst) {
    const e = profile.current_exclusivity[c.index]
    flags.push({
      code: 'exclusivity_nearby',
      severity: 'medium',
      title: `Same category as your ${e.brand} exclusivity`,
      reason: `The content would go live after the exclusivity ends on ${formatDate(e.until)}, so it is not blocked, but check your ${e.brand} contract before announcing or shooting anything earlier.`,
      evidence: c.quote,
      source: 'model+code',
    })
  }

  if (rate && terms.fee && rate.gapPct < 0) {
    flags.push({
      code: 'below_rate',
      severity: rate.gapPct <= -25 ? 'high' : 'medium',
      title: `${Math.abs(rate.gapPct)}% below your rate card`,
      reason: `They offer ${formatInr(rate.offeredInr)}${terms.fee.currency === 'USD' ? ` (${terms.fee.text} at ₹${policy.usdToInr}/USD)` : ''}. Your rates for this work add up to ${formatInr(rate.rateCardInr)}.`,
      source: 'code',
    })
  }
  if (rate && !terms.fee && hasCompensation(terms)) {
    const worth = terms.giftValue ? `Product worth ${formatInr(terms.giftValue.inr)}` : terms.paymentType === 'commission_only' ? 'Commission only, with no guaranteed fee,' : 'Product only, with no fee,'
    flags.push({ code: 'gifting_only', severity: 'high', title: 'No fee offered', reason: `${worth} for work your rate card prices at ${formatInr(rate.rateCardInr)}.`, source: 'code' })
  }
  if (terms.fee?.currencyAssumed) {
    flags.push({ code: 'unparsed_fee', severity: 'low', title: 'Currency not stated', reason: `"${terms.fee.text}" was read as ${formatInr(terms.fee.inr)}. Confirm the currency.`, source: 'code' })
  }

  const usage = terms.usage
  if (usage?.perpetual) {
    flags.push({ code: 'usage_rights', severity: 'high', title: 'Perpetual usage rights', reason: `Your policy: ${profile.usage_rights_policy}`, evidence: usage.text ?? undefined, source: 'code' })
  } else if (usage?.months && usage.months > policy.includedUsageMonths) {
    flags.push({ code: 'usage_rights', severity: 'medium', title: `${usage.months} months of usage`, reason: `Your rate includes ${policy.includedUsageMonths} months. ${profile.usage_rights_policy}`, evidence: usage.text ?? undefined, source: 'code' })
  }
  if (usage?.whitelisting && !flags.some((f) => f.code === 'usage_rights')) {
    flags.push({ code: 'usage_rights', severity: 'medium', title: 'Ads run from your handle', reason: 'Whitelisting lets the brand run ads as you. Agree a time limit and price it separately.', evidence: usage.text ?? undefined, source: 'code' })
  }

  const goLive = terms.deadline?.date
  if (goLive) {
    const days = daysBetween(profile.today, goLive)
    if (days < 0) {
      flags.push({ code: 'deadline_passed', severity: 'high', title: 'Go-live date has already passed', reason: `The email asks for ${formatDate(goLive)}; today is ${formatDate(profile.today)}. The brief cannot be delivered as written.`, evidence: terms.deadline?.text ?? undefined, source: 'code' })
    } else if (days < policy.tightDeadlineDays) {
      flags.push({ code: 'tight_deadline', severity: 'medium', title: days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`, reason: `Go-live is ${formatDate(goLive)}. That leaves little time to shoot, edit and get approval.`, evidence: terms.deadline?.text ?? undefined, source: 'code' })
    }
  }

  const outsider = thirdPartySender(thread)
  if (outsider) {
    flags.push({
      code: 'unverified_third_party',
      severity: 'medium',
      title: 'New sender on this deal',
      reason: `${outsider.email.id} came from ${outsider.email.from}, not from ${thread[0].email.from} who started the thread. Confirm with the original contact before sending documents or tax details.`,
      source: 'code',
    })
  }

  const feeMoves = history.filter((h) => h.field === 'fee')
  if (feeMoves.length) {
    const last = feeMoves[feeMoves.length - 1]
    flags.push({ code: 'terms_changed', severity: 'low', title: 'Fee changed during the thread', reason: `${last.from} → ${last.to} in ${last.emailId}. The latest figure is used.`, source: 'code' })
  }

  const missing = missingDetails(terms)
  if (missing.length && (category === 'deal_offer' || category === 'needs_more_info')) {
    flags.push({ code: 'missing_details', severity: category === 'needs_more_info' ? 'medium' : 'low', title: 'Details not stated', reason: `Not in the email${thread.length > 1 ? 's' : ''}: ${missing.join(', ')}.`, source: 'code' })
  }

  const order = { high: 0, medium: 1, low: 2 }
  return flags.sort((a, b) => order[a.severity] - order[b.severity])
}

export function missingDetails(terms: Terms): string[] {
  return [
    !terms.deliverables.length && 'deliverables',
    !hasCompensation(terms) && 'fee',
    !terms.deadline && 'timeline',
    !terms.usage && 'usage rights',
  ].filter((x): x is string => Boolean(x))
}
