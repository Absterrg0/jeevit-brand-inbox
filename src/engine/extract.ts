import { resolveBrand, type ResolvedBrand } from './brands'
import {
  bestMoney,
  daysBetween,
  giftValue,
  injectionSignals,
  isNewsletter,
  looksLikePhishing,
  lower,
  mentionedAttachment,
  mentionsSmartphone,
  normalize,
  parseDeadline,
  parseDeliverables,
  parseUsage,
  platformOf,
  prohibitedCategory,
  registrationFee,
} from './text'
import type { Category, CreatorProfile, EmailAnalysis, InboxEmail } from './types'

export interface CategoryDecision {
  category: Category
  reason: string
  matches: string[]
}

/** The exclusivity that is live on the email's date, if any. */
export function activeExclusivity(profile: CreatorProfile, today: string) {
  return profile.current_exclusivity.find((x) => x.until >= today)
}

function exclusivityFor(raw: string, profile: CreatorProfile, today: string) {
  for (const x of profile.current_exclusivity) {
    if (x.until < today) continue
    const noun = x.category.replace(/s$/, '')
    const re = new RegExp(`\\b${noun}\\b`, 'i')
    if (re.test(raw) || (noun === 'smartphone' && mentionsSmartphone(raw))) return x
  }
  return null
}

function contactNameFor(email: InboxEmail, brand: ResolvedBrand) {
  const m = email.body.match(/[-–—]\s*([A-Z][A-Za-z]+)(?:\s*,\s*[A-Z]|\s*\.\s*$|\s*$)/)
  if (!m) return null
  const first = brand.name.split(/\s+/)[0].toLowerCase()
  if (m[1].toLowerCase() === first) return null
  return m[1]
}

function notesFor(email: InboxEmail) {
  const raw = `${email.subject} ${email.body}`
  const t = lower(raw)
  const notes: string[] = []
  if (/\bgst\b/i.test(raw)) notes.push('GST details requested')
  if (/all-inclusive/i.test(raw)) notes.push('Fee quoted all-inclusive')
  if (/commission|revenue share/i.test(t)) notes.push('Commission-based, not a flat fee')
  if (/namaste|dhanyavaad|kya aap|\bhum\b/i.test(raw)) notes.push('Hindi-language email')
  if (/on behalf of/i.test(raw)) notes.push('Sent by an agency on the brand’s behalf')
  if (mentionedAttachment(email.body)) notes.push('Says a brief is attached; nothing came with the email')
  if (/phone number|home address/i.test(raw)) notes.push('Asks for personal contact details')
  if (/free products|unlock free/i.test(raw)) notes.push('Product value is dangled, not paid work')
  return notes
}

/**
 * Category rules run in this order. The order is the judgment: safety and
 * hard rules beat commercial appeal, and "is there actually an offer here?"
 * beats enthusiasm. Every reason is written as evidence, not a label.
 */
export function decideCategory(
  email: InboxEmail,
  profile: CreatorProfile,
  _branded: ResolvedBrand,
): CategoryDecision {
  const raw = `${email.subject}\n${email.body}`
  const t = lower(raw)

  const injections = injectionSignals(raw)
  const phishing = looksLikePhishing(email.from, email.subject, email.body)
  if (injections.length) {
    return {
      category: 'scam_or_phishing',
      reason: 'The body contains instructions aimed at an AI assistant and asks for personal contact details. Treated as hostile text, never followed.',
      matches: injections,
    }
  }
  if (phishing.length) {
    return {
      category: 'scam_or_phishing',
      reason: `Impersonates the platform it claims to protect. ${email.from.split('@')[1]} is not an official domain, and the email uses a 24-hour suspension threat to force a click.`,
      matches: phishing,
    }
  }
  const registration = registrationFee(email.body)
  if (registration !== null && /\b(?:selected|ambassador|programme|program|unlock|opportunity)\b/i.test(t)) {
    return {
      category: 'scam_or_phishing',
      reason: `Asks the creator to pay ₹${registration.toLocaleString('en-IN')} up front to join. Your rules say you never pay to join a programme, and this is the classic pay-to-join shape.`,
      matches: ['registration fee requested', '24-hour urgency'],
    }
  }
  if (isNewsletter(email.subject, email.body)) {
    return {
      category: 'spam',
      reason: 'A bulk newsletter: an unsubscribe link, a round-up, and no ask of any kind.',
      matches: ['bulk mail with unsubscribe', 'no offer or request'],
    }
  }

  const prohibited = prohibitedCategory(raw)
  if (prohibited) {
    return {
      category: 'not_a_fit',
      reason: `Real offer, but it is for ${prohibited} — one of your standing content rules.`,
      matches: [`prohibited category: ${prohibited}`],
    }
  }

  const exclusivity = exclusivityFor(raw, profile, profile.today)
  if (exclusivity) {
    return {
      category: 'not_a_fit',
      reason: `Real ${exclusivity.category} offer, but your ${exclusivity.brand} exclusivity runs until ${exclusivity.until}.`,
      matches: [`active exclusivity: ${exclusivity.brand}, ${exclusivity.category}`],
    }
  }

  const fee = bestMoney(email.body)
  const deliverables = parseDeliverables(raw)
  const deadline = parseDeadline(email.body, email.received_at)
  const usage = parseUsage(raw)

  if (!fee && !deliverables.length) {
    const attach = mentionedAttachment(email.body)
    return {
      category: 'needs_more_info',
      reason: attach
        ? 'Says a campaign brief is attached, but no brief came with the email — and there is no fee, deliverable or date in the body.'
        : 'A real-sounding introduction with no fee, deliverables, timeline or usage rights. Nothing yet to judge.',
      matches: attach ? ['referenced attachment is missing'] : ['no fee', 'no deliverable', 'no timeline'],
    }
  }

  if (deadline.date && deadline.date < profile.today) {
    return {
      category: 'needs_more_info',
      reason: `The brief asks for the content by ${deadline.raw ?? deadline.date}, which had already passed when the email arrived on ${email.received_at.slice(0, 10)}. The date needs correcting before this can be a real deal.`,
      matches: ['deadline is in the past'],
    }
  }

  if (!deadline.date && !deadline.relative && !usage.months && !usage.perpetual) {
    return {
      category: 'needs_more_info',
      reason: 'There is a fee and a deliverable, but no timeline and no usage rights — the two terms that decide whether the fee is fair.',
      matches: ['no deadline', 'no usage rights'],
    }
  }

  if (fee || deliverables.length) {
    return {
      category: 'deal_offer',
      reason: fee?.basis === 'gifting'
        ? 'A real barter offer: a product instead of a fee.'
        : 'A real paid offer with a fee, deliverables and enough terms to assess.',
      matches: [
        ...(fee ? [`fee: ${fee.quote ?? fee.amount}`] : []),
        ...(deliverables.length ? [`${deliverables.length} deliverable type(s)`] : []),
        ...(deadline.date ? [`deadline: ${deadline.date}`] : []),
      ],
    }
  }

  return {
    category: 'needs_more_info',
    reason: 'Possibly real, but not enough detail to classify as an offer yet.',
    matches: ['thin brief'],
  }
}

export interface CategoryOverride {
  category: Category
  reason: string
}

export function extractEmail(email: InboxEmail, profile: CreatorProfile, override?: CategoryOverride): EmailAnalysis {
  const brand = resolveBrand(email)
  const raw = `${email.subject}\n${email.body}`
  let decision = decideCategory(email, profile, brand)

  // A second opinion is only allowed on emails the rules already found ambiguous.
  // It can never overrule a scam or a hard rule — those are deterministic.
  if (override && (decision.category === 'needs_more_info' || decision.category === 'spam')) {
    decision = {
      category: override.category,
      reason: `Second opinion (model): ${override.reason}`,
      matches: [...decision.matches, 'reviewed by model'],
    }
  }
  const deliverables = parseDeliverables(raw)
  const deadline = parseDeadline(email.body, email.received_at)
  const usage = parseUsage(raw)
  const extractedFee = bestMoney(email.body)
  const notes = notesFor(email)
  const gift = giftValue(email.body)

  // A scam's quoted "fee" is bait, not a term sheet. Keep it in matches, not in the fee.
  const fee = decision.category === 'scam_or_phishing' || decision.category === 'spam' ? null : extractedFee

  if (gift !== null && fee?.basis === 'gifting') notes.push(`Gift value about ₹${gift.toLocaleString('en-IN')}`)
  if (deadline.date && daysBetween(profile.today, deadline.date) < 0) notes.push('Deadline is in the past')
  if (decision.category === 'scam_or_phishing' && registrationFee(email.body) !== null) {
    notes.push(`Asks for ₹${registrationFee(email.body)!.toLocaleString('en-IN')} to join`)
  }

  return {
    id: email.id,
    brandKey: brand.key,
    receivedAt: email.received_at,
    from: email.from,
    subject: email.subject,
    body: email.body,
    brand: brand.name,
    contactName: contactNameFor(email, brand),
    platform: platformOf(deliverables),
    deliverables,
    fee,
    deadline,
    usage,
    notes,
    category: decision.category,
    categoryReason: decision.reason,
    injection: injectionSignals(raw).length > 0,
    matches: [...decision.matches, ...(fee?.quote ? [`fee quote: “${fee.quote}”`] : [])],
  }
}

export function sanitizeForDisplay(body: string) {
  return normalize(body)
}
