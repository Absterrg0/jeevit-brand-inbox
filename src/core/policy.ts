/**
 * The action policy: category + flags → one recommended next step, the reason
 * for it, a counter-offer where one applies, and the points a reply must make.
 *
 * This is a fixed table on purpose. The first two rows are the safety override:
 * whatever an email says, and whatever the model returned, a scam can only ever
 * map to "report" and never gets a draft reply.
 */
import type { Action, Category, Deal, Flag, Profile, RateCheck, Terms } from '../types'
import { formatDate } from './dates'
import { formatMoney } from './money'
import type { Policy } from './profile'
import type { Blocks } from './risk'
import { missingDetails } from './risk'

const has = (flags: Flag[], code: Flag['code']) => flags.some((f) => f.code === code)

export function decideAction(category: Category, flags: Flag[]): Action {
  if (category === 'scam_or_phishing') return 'report'
  if (has(flags, 'analysis_failed') || has(flags, 'unverified_conflict')) return 'review_manually'
  if (category === 'spam') return 'ignore'
  if (category === 'not_a_fit') return 'decline'
  if (category === 'needs_more_info') return 'ask_for_details'
  // deal_offer
  if (has(flags, 'deadline_passed')) return 'ask_for_details'
  if (has(flags, 'below_rate') || has(flags, 'gifting_only') || has(flags, 'usage_rights') || has(flags, 'tight_deadline')) return 'negotiate'
  return 'accept'
}

export const REPLY_ACTIONS: ReadonlySet<Action> = new Set(['accept', 'negotiate', 'ask_for_details', 'decline'])

/**
 * Counter at the rate card, or at the brand's own best earlier offer if that was
 * higher: a brand that opened at ₹1,20,000 has already shown it can pay that.
 */
export function counterOffer(terms: Terms, rate: RateCheck | null, history: Deal['history'], flags: Flag[], policy: Policy): Deal['counter'] {
  if (!rate || !(has(flags, 'below_rate') || has(flags, 'gifting_only'))) return null
  let inr = rate.rateCardInr
  for (const h of history.filter((x) => x.field === 'fee')) {
    const earlier = /^(INR|USD) ([\d,]+)$/.exec(h.from)
    if (!earlier) continue
    const amount = Number(earlier[2].replace(/,/g, ''))
    inr = Math.max(inr, earlier[1] === 'USD' ? amount * policy.usdToInr : amount)
  }
  if (terms.fee?.currency === 'USD') return { amount: Math.ceil(inr / policy.usdToInr / 10) * 10, currency: 'USD' }
  return { amount: inr, currency: 'INR' }
}

const NAMES: Record<string, [string, string]> = {
  instagram_reel: ['Instagram reel', 'Instagram reels'],
  instagram_story: ['Instagram story', 'Instagram stories'],
  instagram_post: ['Instagram post', 'Instagram posts'],
  youtube_integration: ['YouTube integration', 'YouTube integrations'],
  youtube_dedicated_video: ['dedicated YouTube video', 'dedicated YouTube videos'],
  youtube_short: ['YouTube Short', 'YouTube Shorts'],
  other: ['other deliverable', 'other deliverables'],
}

/** "2 Instagram reels and 3 Instagram stories" */
export function describeDeliverables(terms: Terms): string {
  const parts = terms.deliverables.map((d) => `${d.count} ${NAMES[d.type][d.count === 1 ? 0 : 1]}`)
  return parts.length <= 1 ? (parts[0] ?? 'the work') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function explain(action: Action, category: Category, flags: Flag[], reason: string): string {
  const top = flags[0]
  switch (action) {
    case 'report':
      return top ? `${top.title}. Do not reply, pay or click; report it as phishing.` : 'Scam. Do not reply.'
    case 'ignore':
      return 'Not a brand offer. Nothing to do.'
    case 'review_manually':
      return has(flags, 'unverified_conflict') ? 'The model raised a possible conflict it could not back up with words from the email. Read it yourself before replying.' : 'This email could not be analysed automatically. Read it yourself.'
    case 'decline':
      return top ? `${top.title}. Decline politely.` : reason
    case 'ask_for_details':
      return has(flags, 'deadline_passed')
        ? 'The go-live date has already passed. Ask them to confirm the dates before anything else.'
        : `${flags.find((f) => f.code === 'missing_details')?.reason ?? reason} Ask before spending time on it.`
    case 'negotiate':
      return `${flags.filter((f) => ['below_rate', 'gifting_only', 'usage_rights', 'tight_deadline'].includes(f.code)).map((f) => f.title).join('; ')}. Counter before agreeing.`
    case 'accept':
      return category === 'deal_offer' ? 'At or above your rates, no rule or exclusivity conflict, and the deadline is workable.' : reason
  }
}

/**
 * The content of the reply, as first-person sentences. The drafting model may
 * only rephrase and translate these; it does not decide what the reply says.
 */
export function replyPoints(input: {
  action: Action
  terms: Terms
  flags: Flag[]
  rate: RateCheck | null
  counter: Deal['counter']
  history: Deal['history']
  blocks: Blocks
  profile: Profile
  policy: Policy
}): string[] {
  const { action, terms, flags, rate, counter, history, blocks, profile, policy } = input
  const points: string[] = []
  const work = describeDeliverables(terms)
  const missing = missingDetails(terms)

  if (action === 'decline') {
    for (const c of blocks.exclusivity) {
      const e = profile.current_exclusivity[c.index]
      points.push(`I have an exclusive partnership in the ${e.category} category until ${formatDate(e.until)}, so I can't take this on right now.`)
      points.push('I would be glad to talk again after that date.')
    }
    for (const r of blocks.rule) points.push(`This falls outside what I promote. My standing rule is: "${profile.content_rules[r.rule]}"`)
    if (!points.length) points.push("This isn't a fit for my channel right now.")
    points.push('Thank you for thinking of me.')
    return points
  }

  if (action === 'ask_for_details') {
    if (has(flags, 'deadline_passed') && terms.deadline?.date) {
      points.push(`Your email asks for the content to go live by ${formatDate(terms.deadline.date)}, which has already passed. Could you confirm the correct date?`)
      if (terms.fee && !has(flags, 'below_rate')) points.push(`The budget of ${formatMoney(terms.fee.amount, terms.fee.currency)} for ${work} works for me once the date is sorted.`)
    } else {
      points.push('Thanks for getting in touch. I would like to hear more.')
      points.push(`Could you share the ${missing.join(', ')} you have in mind? If you attached a brief, it did not come through, so please paste the key points in your reply.`)
    }
    return points
  }

  if (action === 'negotiate') {
    if (counter && has(flags, 'below_rate')) {
      const matchesEarlier = history.some((h) => h.field === 'fee' && h.from === formatMoney(counter.amount, counter.currency))
      points.push(`For ${work}, my fee is ${formatMoney(counter.amount, counter.currency)}${matchesEarlier ? ', which is the budget you first proposed' : ''}.`)
    }
    if (counter && has(flags, 'gifting_only')) {
      points.push(`Thank you for the offer to send the product. I don't take gifting-only collaborations for this scope; my fee for ${work} is ${formatMoney(counter.amount, counter.currency)}.`)
    }
    if (terms.fee && !has(flags, 'below_rate')) points.push(`The fee of ${formatMoney(terms.fee.amount, terms.fee.currency)} for ${work} works for me.`)
    if (has(flags, 'usage_rights')) {
      const ask = terms.usage?.perpetual ? 'Perpetual usage' : terms.usage?.whitelisting && !(terms.usage.months && terms.usage.months > policy.includedUsageMonths) ? 'Whitelisting on my handle' : `${terms.usage?.months} months of usage`
      points.push(`My fee includes up to ${policy.includedUsageMonths} months of paid-ad usage. ${ask} would need to be priced separately. Can we keep usage to ${policy.includedUsageMonths} months, or what budget do you have for the extended rights?`)
    }
    if (has(flags, 'tight_deadline')) points.push('The timeline is very tight. Could the go-live date move by a few days so I can deliver this properly?')
    if (missing.length) points.push(`Please also confirm the ${missing.join(' and ')}.`)
  }

  if (action === 'accept') {
    const bits = [work, terms.fee && formatMoney(terms.fee.amount, terms.fee.currency), terms.deadline?.date && `live by ${formatDate(terms.deadline.date)}`].filter(Boolean)
    points.push(`The terms work for me: ${bits.join(', ')}.`)
    if (missing.length) points.push(`Before we start, please confirm the ${missing.join(' and ')}.`)
    points.push('Please send over the agreement and brief, and I will get started.')
  }

  if (has(flags, 'unverified_third_party')) {
    points.push('As this is the first time I am hearing from you on this campaign, could you copy in my original contact at the brand? I will share invoicing details once the terms are agreed.')
  }
  if (rate?.unpriced.length && action !== 'accept') points.push(`I will need a little more detail on the ${rate.unpriced.join(', ')} to price it.`)
  return points
}

const ACTION_ORDER: Record<Action, number> = { review_manually: 0, negotiate: 1, accept: 1, ask_for_details: 1, decline: 2, report: 3, ignore: 4 }

/** Sort for the creator: things that need a reply first, soonest deadline first, then bigger money. */
export function rankDeals(deals: Deal[]): Deal[] {
  const far = '9999-12-31'
  const sorted = [...deals].sort(
    (a, b) =>
      ACTION_ORDER[a.action] - ACTION_ORDER[b.action] ||
      (a.terms.deadline?.date ?? far).localeCompare(b.terms.deadline?.date ?? far) ||
      (b.terms.fee?.inr ?? 0) - (a.terms.fee?.inr ?? 0) ||
      a.id.localeCompare(b.id),
  )
  return sorted.map((d, i) => ({ ...d, rank: i + 1 }))
}
