import { activeExclusivity } from './extract'
import {
  daysBetween,
  formatInr,
  mentionedAttachment,
  mentionsSmartphone,
  prohibitedCategory,
  registrationFee,
  shortDate,
  shortInr,
} from './text'
import type {
  Action,
  Category,
  CreatorProfile,
  Deal,
  DeliverableKind,
  EmailAnalysis,
  Extraction,
  RateComparison,
  RiskFlag,
  Severity,
} from './types'

const RATE_KEY: Record<DeliverableKind, string> = {
  instagram_reel: 'instagram_reel',
  instagram_story: 'instagram_story',
  youtube_integration: 'youtube_integration',
  youtube_dedicated_video: 'youtube_dedicated_video',
  // There is no shoutout line on the rate card; an integration is the closest proxy.
  youtube_shoutout: 'youtube_integration',
}

const DELIVERABLE_LABEL: Record<DeliverableKind, [string, string]> = {
  instagram_reel: ['Instagram reel', 'Instagram reels'],
  instagram_story: ['Instagram story', 'Instagram stories'],
  youtube_integration: ['YouTube integration', 'YouTube integrations'],
  youtube_dedicated_video: ['YouTube dedicated video', 'YouTube dedicated videos'],
  youtube_shoutout: ['YouTube shoutout', 'YouTube shoutouts'],
}

export function deliverableText(deliverables: Extraction['deliverables']) {
  return deliverables
    .map((d) => `${d.qty} ${d.qty === 1 ? DELIVERABLE_LABEL[d.kind][0] : DELIVERABLE_LABEL[d.kind][1]}`)
    .join(' + ')
}

/** Drops the "1" for prose: "the Instagram reel", "the 2 reels + 3 stories". */
export const deliverableNoun = (deliverables: Extraction['deliverables']) => deliverableText(deliverables).replace(/^1 /, '')

export function compareRate(terms: Extraction, profile: CreatorProfile): RateComparison {
  let rate = 0
  const proxies: DeliverableKind[] = []
  for (const d of terms.deliverables) {
    const key = RATE_KEY[d.kind]
    rate += (profile.base_rates_inr[key] ?? 0) * d.qty
    if (d.kind === 'youtube_shoutout') proxies.push(d.kind)
  }
  const offered = terms.fee?.inr ?? null
  const delta = offered === null || rate === 0 ? null : offered - rate
  const pct = delta === null || rate === 0 ? null : (delta / rate) * 100
  return {
    rateInr: rate,
    offeredInr: offered,
    deltaInr: delta,
    pct,
    ...(proxies.length ? { proxyFor: proxies } : {}),
  }
}

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 34, medium: 18, low: 6 }

export function riskScore(risks: RiskFlag[]) {
  return Math.min(100, risks.reduce((n, r) => n + SEVERITY_WEIGHT[r.severity], 0))
}

function add(list: RiskFlag[], flag: RiskFlag) {
  if (!list.some((f) => f.code === flag.code)) list.push(flag)
}

function rawOf(emails: EmailAnalysis[]) {
  return emails.map((e) => `${e.subject}\n${e.body}`).join('\n')
}

/**
 * Risk is always judged against the creator's own profile: their rate card,
 * their exclusivity, their content rules, their usage policy. A flag without a
 * number or a rule behind it is noise, so each one carries its evidence.
 */
export function assessRisks(
  category: Category,
  terms: Extraction,
  rate: RateComparison,
  emails: EmailAnalysis[],
  profile: CreatorProfile,
): RiskFlag[] {
  const risks: RiskFlag[] = []
  const raw = rawOf(emails)
  const daysLeft = terms.deadline.date ? daysBetween(profile.today, terms.deadline.date) : null
  const windowStart = terms.deadline.window?.start
  const daysToWindow = windowStart ? daysBetween(profile.today, windowStart) : null

  if (category === 'scam_or_phishing') {
    if (emails.some((e) => e.injection)) {
      add(risks, {
        code: 'prompt_injection',
        severity: 'high',
        title: 'Instructions aimed at an AI assistant',
        why: 'The email tells the reader how to classify it and what to reply. That text is data: it is ignored, and the attempt itself is a red flag.',
        evidence: emails.find((e) => e.injection)?.body.slice(0, 150),
      })
    }
    if (/phone number|home address|aadhaar|otp|password|bank details/i.test(raw)) {
      add(risks, {
        code: 'personal_data_request',
        severity: 'high',
        title: 'Asks for personal data',
        why: 'No legitimate brand needs a home address or phone number before a contract exists.',
        evidence: 'asks for a phone number and home address',
      })
    }
    if (registrationFee(raw) !== null) {
      add(risks, {
        code: 'pay_to_join',
        severity: 'high',
        title: 'Pay-to-join',
        why: 'Your rules say you never pay to join a programme. Money only ever flows to the creator.',
        evidence: `₹${registrationFee(raw)!.toLocaleString('en-IN')} registration fee`,
      })
    }
    if (/https?:\/\//i.test(raw) || /suspended|terminated|copyright strikes?/i.test(raw)) {
      add(risks, {
        code: 'phishing',
        severity: 'high',
        title: 'Lookalike domain and a suspension threat',
        why: 'The sender is not the platform it names, and the urgency exists to stop you checking.',
        evidence: emails[0]?.from,
      })
    }
    if (/24 hours|today only|expires|valid .{0,12}only/i.test(raw)) {
      add(risks, {
        code: 'urgency_pressure',
        severity: 'medium',
        title: 'Artificial urgency',
        why: 'A 24-hour window is there to prevent a second opinion, not to serve the campaign.',
      })
    }
    if (/30% commission|free products worth|guaranteed|unlock/i.test(raw)) {
      add(risks, {
        code: 'unrealistic_promise',
        severity: 'medium',
        title: 'Promise does not add up',
        why: 'A fee to unlock “free” product and commission is the shape of an advance-fee scam.',
      })
    }
    return sortRisks(risks)
  }

  if (category === 'not_a_fit') {
    const prohibited = prohibitedCategory(raw)
    if (prohibited) {
      add(risks, {
        code: 'content_rule',
        severity: 'high',
        title: 'Breaks a content rule',
        why: `This is a ${prohibited} promotion. Your profile excludes it, so the fee cannot be taken at any price.`,
        evidence: emails[0]?.subject,
      })
    }
    const exclusivity = activeExclusivity(profile, profile.today)
    if (exclusivity && (mentionsSmartphone(raw) || new RegExp(exclusivity.category.replace(/s$/, ''), 'i').test(raw))) {
      add(risks, {
        code: 'exclusivity_conflict',
        severity: 'high',
        title: `Conflicts with ${exclusivity.brand}`,
        why: `Your ${exclusivity.brand} agreement covers ${exclusivity.category} until ${exclusivity.until}. Taking a competing brand would breach it.`,
        evidence: emails[0]?.brand,
      })
    }
  }

  if (terms.fee?.basis === 'gifting' && rate.rateInr > 0) {
    const gift = terms.fee.inr
    add(risks, {
      code: 'gifting_undervalued',
      severity: 'high',
      title: 'Unpaid work dressed as a gift',
      why: `${deliverableText(terms.deliverables)} is ${shortInr(rate.rateInr)} of work at your rates. The product is worth ${shortInr(gift)}.`,
      evidence: terms.fee.quote,
    })
  } else if (terms.fee?.basis === 'cash' && rate.deltaInr !== null && rate.pct !== null && rate.pct < -5) {
    const shortfall = Math.abs(rate.deltaInr)
    add(risks, {
      code: 'below_rate',
      severity: rate.pct <= -20 ? 'high' : 'medium',
      title: 'Below your rate',
      why: `${shortInr(terms.fee.inr)} is ${shortInr(shortfall)} under your ${shortInr(rate.rateInr)} rate for ${deliverableText(terms.deliverables)} (${Math.round(rate.pct)}%).`,
      evidence: terms.fee.quote,
    })
  }

  const usage = terms.usage
  if (usage.perpetual || usage.whitelisting || (usage.months !== null && usage.months > 3)) {
    add(risks, {
      code: 'usage_buyout',
      severity: usage.perpetual || usage.whitelisting ? 'high' : 'medium',
      title: usage.perpetual ? 'Perpetual usage rights' : usage.whitelisting ? 'Whitelisting on your handle' : `${usage.months} months of usage`,
      why: `Your rate includes up to 3 months of paid-ad usage. ${usage.perpetual ? 'Perpetual rights' : usage.whitelisting ? 'Whitelisting for ads' : `${usage.months} months`} is a separate buyout and has to be priced.`,
      evidence: usage.raw ?? undefined,
    })
  }

  if (daysLeft !== null && daysLeft < 0) {
    add(risks, {
      code: 'impossible_deadline',
      severity: 'high',
      title: 'Deadline has already passed',
      why: `The email asks for the content by ${shortDate(terms.deadline.date!)} — ${Math.abs(daysLeft)} days before it was sent.`,
      evidence: terms.deadline.raw ?? undefined,
    })
  } else if (daysToWindow !== null && daysToWindow <= 4 && daysToWindow >= 0) {
    add(risks, {
      code: 'tight_deadline',
      severity: 'medium',
      title: 'Tight turnaround',
      why: `The posting window opens ${shortDate(windowStart!)} — ${daysToWindow} days away — for ${deliverableText(terms.deliverables)}.`,
      evidence: terms.deadline.raw ?? undefined,
    })
  } else if (daysLeft !== null && daysLeft <= 5) {
    add(risks, {
      code: 'tight_deadline',
      severity: 'medium',
      title: 'Tight turnaround',
      why: `Only ${daysLeft} days to deliver and get approval.`,
      evidence: terms.deadline.raw ?? undefined,
    })
  }

  if (category === 'needs_more_info') {
    if (mentionedAttachment(raw) && !terms.deliverables.length) {
      add(risks, {
        code: 'missing_attachment',
        severity: 'medium',
        title: 'The brief is missing',
        why: 'The email refers to an attached campaign brief, but no brief came with it. Do not guess at deliverables.',
      })
    } else {
      const missing = [!terms.fee ? 'fee' : null, !terms.deliverables.length ? 'deliverables' : null, !terms.deadline.date && !terms.deadline.relative ? 'timeline' : null, !terms.usage.months && !terms.usage.perpetual ? 'usage rights' : null].filter(Boolean)
      add(risks, {
        code: 'incomplete_brief',
        severity: 'medium',
        title: 'Key terms are missing',
        why: `No ${missing.join(', ')}. A yes now would be a blank cheque.`,
      })
    }
  }

  if (category === 'deal_offer' && /all-inclusive/i.test(raw) && terms.deliverables.length > 1) {
    add(risks, {
      code: 'incomplete_brief',
      severity: 'low',
      title: '“All-inclusive” covers production',
      why: 'The fee has to absorb shoot costs as well as the deliverables. Worth confirming what is included.',
    })
  }

  if (/24 hours|today only|expires/i.test(raw)) {
    add(risks, {
      code: 'urgency_pressure',
      severity: 'low',
      title: 'Short window',
      why: 'The email asks for a decision on a deadline measured in hours.',
    })
  }

  return sortRisks(risks)
}

const ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
const sortRisks = (risks: RiskFlag[]) => [...risks].sort((a, b) => ORDER[a.severity] - ORDER[b.severity])

export function decideAction(
  category: Category,
  terms: Extraction,
  risks: RiskFlag[],
  rate: RateComparison,
): { action: Action; reason: string } {
  const codes = new Set(risks.map((r) => r.code))
  if (category === 'scam_or_phishing') {
    return {
      action: 'report',
      reason: codes.has('prompt_injection')
        ? 'No reply. Report it: the email is trying to extract money or personal data through instructions, not to hire you.'
        : 'No reply. Report it to the mail provider so the sender is blocked for other creators too.',
    }
  }
  if (category === 'spam') {
    return { action: 'ignore', reason: 'Nothing to answer. Leave it unread or archive it.' }
  }
  if (category === 'not_a_fit') {
    if (codes.has('content_rule')) {
      return { action: 'decline', reason: 'The fee is high; the rule is higher. Decline without a counter.' }
    }
    return { action: 'decline', reason: 'Good money, but taking it would breach the Nova Phones exclusivity. Decline and offer to talk after 31 Jan 2027.' }
  }
  if (category === 'needs_more_info') {
    if (codes.has('below_rate') && terms.fee) {
      const gap = Math.abs(rate.deltaInr ?? 0)
      return {
        action: 'ask_for_details',
        reason: `${formatInr(terms.fee.inr)} is ${formatInr(gap)} under your ${formatInr(rate.rateInr)} rate, and the timeline and usage rights are missing. Ask for all three, and hold your rate.`,
      }
    }
    if (codes.has('impossible_deadline')) {
      return {
        action: 'ask_for_details',
        reason: 'There is no feasible version of this date. Ask for the next window and the usage terms before pricing the work.',
      }
    }
    return {
      action: 'ask_for_details',
      reason: 'Possibly a real deal, but a yes now would be guesswork. Ask for the missing terms in one short reply.',
    }
  }
  if (terms.fee?.basis === 'gifting') {
    return { action: 'decline', reason: 'This is paid work at your rate, offered as a ₹3,500 gift. Decline, or counter with a cash rate.' }
  }
  if (codes.has('usage_buyout')) {
    return {
      action: 'negotiate',
      reason: 'The fee clears your rate, but perpetual usage and whitelisting are not in it. Price the buyout or cap the rights.',
    }
  }
  if (codes.has('below_rate')) {
    return {
      action: 'negotiate',
      reason: `The latest terms are ${formatInr(Math.abs(rate.deltaInr ?? 0))} under your ${formatInr(rate.rateInr)} rate for the same deliverables. Counter at your rate.`,
    }
  }
  if (codes.has('tight_deadline')) {
    return { action: 'negotiate', reason: 'The fee works; the turnaround does not. Confirm a realistic go-live before accepting.' }
  }
  return { action: 'accept', reason: 'Terms meet your rate, your rules and your usage policy. Accept and lock the dates.' }
}

export function priorityFor(deal: Pick<Deal, 'risks' | 'action' | 'rate' | 'terms'>, profile: CreatorProfile) {
  let score = riskScore(deal.risks)
  const days = deal.terms.deadline.date ? daysBetween(profile.today, deal.terms.deadline.date) : null
  if (days !== null) score += days < 0 ? 12 : days <= 7 ? 18 : days <= 14 ? 8 : 0
  score += { negotiate: 14, ask_for_details: 10, accept: 8, decline: 4, report: 0, ignore: 0 }[deal.action]
  const money = deal.rate.offeredInr ?? 0
  score += money >= 100_000 ? 10 : money >= 50_000 ? 6 : money > 0 ? 2 : 0
  return Math.min(100, score)
}

export function oneLineSummary(category: Category, terms: Extraction, rate: RateComparison, action: Action) {
  const things = deliverableText(terms.deliverables) || 'No deliverables yet'
  if (category === 'scam_or_phishing') return 'Not a deal. Report it and do not reply.'
  if (category === 'spam') return 'Newsletter. No action.'
  if (category === 'not_a_fit') return `${things}; blocked by your rules.`
  if (category === 'needs_more_info') return `${things}. Missing key terms before a yes.`
  if (terms.fee?.basis === 'gifting') return `${things} for a gift worth ${shortInr(terms.fee.inr)}.`
  const money = terms.fee ? shortInr(terms.fee.inr) : 'No fee'
  const delta = rate.pct === null ? '' : rate.pct >= 0 ? `, ${Math.round(rate.pct)}% above your rate` : `, ${Math.abs(Math.round(rate.pct))}% under your rate`
  return `${money} for ${things.toLowerCase()}${delta}. ${action === 'negotiate' ? 'Counter.' : action === 'accept' ? 'Ready to accept.' : ''}`.trim()
}
