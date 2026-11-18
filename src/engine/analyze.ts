import { assessRisks, compareRate, decideAction, deliverableText, oneLineSummary, priorityFor } from './assess'
import { buildDraft } from './draft'
import { extractEmail, type CategoryOverride } from './extract'
import { formatInr, shortDate, shortInr, weekdayDate } from './text'
import type {
  Action,
  Analysis,
  AttentionItem,
  Category,
  CreatorProfile,
  Deal,
  EmailAnalysis,
  Extraction,
  InboxEmail,
  Severity,
  Summary,
} from './types'

const ACTIONS: Action[] = ['accept', 'negotiate', 'ask_for_details', 'decline', 'ignore', 'report']
const CATEGORIES: Category[] = ['deal_offer', 'needs_more_info', 'not_a_fit', 'scam_or_phishing', 'spam']

/** The most recent email that actually states this term. A follow-up that says "same deliverables" must not erase them. */
function latestOf<T>(emails: EmailAnalysis[], pick: (email: EmailAnalysis) => T | null | undefined): T | null {
  for (let i = emails.length - 1; i >= 0; i--) {
    const value = pick(emails[i])
    if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) return value
  }
  return null
}

function mergeTerms(emails: EmailAnalysis[]): Extraction {
  const deliverables = latestOf(emails, (e) => e.deliverables) ?? []
  const platform = deliverables.some((d) => d.kind.startsWith('instagram_'))
    ? deliverables.some((d) => d.kind.startsWith('youtube_'))
      ? ('both' as const)
      : ('instagram' as const)
    : deliverables.some((d) => d.kind.startsWith('youtube_'))
      ? ('youtube' as const)
      : null

  return {
    brand: emails[emails.length - 1].brand,
    contactName: latestOf(emails, (e) => e.contactName),
    platform,
    deliverables,
    fee: latestOf(emails, (e) => e.fee),
    deadline: latestOf(emails, (e) => (e.deadline.date || e.deadline.relative ? e.deadline : null)) ?? {
      date: null,
      relative: null,
      window: null,
      raw: null,
    },
    usage: latestOf(emails, (e) => (e.usage.raw || e.usage.months || e.usage.perpetual ? e.usage : null)) ?? {
      months: null,
      perpetual: false,
      paidAds: false,
      whitelisting: false,
      raw: null,
    },
    notes: emails[emails.length - 1].notes,
  }
}

function attentionLine(deal: Deal): string {
  const codes = new Set(deal.risks.map((r) => r.code))
  const things = deal.terms.deliverables.length ? deliverableText(deal.terms.deliverables) : 'the brief'
  if (deal.action === 'negotiate') {
    if (codes.has('usage_buyout')) return `Reprice usage before ${deal.terms.deadline.date ? shortDate(deal.terms.deadline.date) : 'you accept'}`
    if (codes.has('below_rate')) return `Counter ${formatInr(deal.rate.rateInr)} for ${things}`
    return 'Confirm a realistic go-live before accepting'
  }
  if (deal.action === 'ask_for_details') {
    if (codes.has('impossible_deadline')) return `The ${deal.terms.deadline.date ? shortDate(deal.terms.deadline.date) : 'stated'} date has passed — ask for a new window`
    return 'Ask for the missing terms before saying yes'
  }
  if (deal.action === 'decline') {
    if (codes.has('exclusivity_conflict')) return 'Decline: Nova Phones exclusivity'
    if (codes.has('content_rule')) return 'Decline: gambling content rule'
    return 'Decline the barter'
  }
  return 'Lock the dates and accept'
}

function blockedLine(deal: Deal): string {
  if (deal.action === 'report') {
    if (deal.risks.some((r) => r.code === 'prompt_injection')) return 'Aim at an AI assistant, not a creator — report'
    if (deal.risks.some((r) => r.code === 'pay_to_join')) return 'Pay-to-join ambassador scam — report'
    return 'Fake platform suspension notice — report'
  }
  return 'Bulk newsletter — ignore'
}

const topSeverity = (deal: Deal): Severity | null => deal.risks[0]?.severity ?? null

function buildSummary(deals: Deal[], emails: EmailAnalysis[], profile: CreatorProfile): Summary {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, emails.filter((e) => e.category === c).length])) as Record<Category, number>
  const byAction = Object.fromEntries(ACTIONS.map((a) => [a, deals.filter((d) => d.action === a).length])) as Record<Action, number>
  const real = deals.filter((d) => d.category !== 'scam_or_phishing' && d.category !== 'spam')
  const cash = real.filter((d) => d.terms.fee?.basis === 'cash' && d.terms.fee)
  const sum = (list: Deal[]) => list.reduce((n, d) => n + (d.terms.fee?.inr ?? 0), 0)

  // A counter or a question changes the outcome; a decline is tidying up. Sort by
  // that first, then by how much the deal is worth and how much risk it carries.
  const rank: Record<string, number> = { negotiate: 0, ask_for_details: 1, accept: 2, decline: 3 }
  const actionable = deals
    .filter((d) => ['accept', 'negotiate', 'ask_for_details', 'decline'].includes(d.action))
    .sort((a, b) => rank[a.action] - rank[b.action] || b.priority - a.priority)
  const blockedDeals = deals
    .filter((d) => d.action === 'report' || d.action === 'ignore')
    .sort((a, b) => (a.action === b.action ? 0 : a.action === 'report' ? -1 : 1))

  const attention: AttentionItem[] = actionable.map((d) => ({
    dealId: d.id,
    brand: d.brand,
    line: attentionLine(d),
    action: d.action,
    severity: topSeverity(d),
  }))
  const blocked: AttentionItem[] = blockedDeals.map((d) => ({
    dealId: d.id,
    brand: d.brand,
    line: blockedLine(d),
    action: d.action,
    severity: topSeverity(d),
  }))

  const money = {
    offeredInr: sum(cash),
    actionableInr: sum(cash.filter((d) => ['accept', 'negotiate', 'ask_for_details'].includes(d.action))),
    atOrAboveRateInr: sum(cash.filter((d) => (d.rate.deltaInr ?? 0) >= 0)),
    belowRateInr: cash.reduce((n, d) => n + (d.risks.some((r) => r.code === 'below_rate') ? Math.abs(d.rate.deltaInr ?? 0) : 0), 0),
    blockedInr: sum(real.filter((d) => d.category === 'not_a_fit')),
  }

  const below = real.filter((d) => d.risks.some((r) => r.code === 'below_rate') && d.terms.fee?.basis === 'cash')
  const barter = real.find((d) => d.terms.fee?.basis === 'gifting' && d.risks.some((r) => r.code === 'gifting_undervalued'))
  const stale = real.filter((d) => d.risks.some((r) => r.code === 'impossible_deadline'))
  const blockedFit = real.filter((d) => d.category === 'not_a_fit')
  const scams = deals.filter((d) => d.action === 'report')
  const spam = deals.filter((d) => d.action === 'ignore')

  const paragraphs: string[] = []
  if (below.length) {
    const parts = below.map((d) => `${d.brand} by ${formatInr(Math.abs(d.rate.deltaInr ?? 0))}`)
    paragraphs.push(
      `${below.length === 1 ? 'One offer sits' : `${below.length} offers sit`} under your rate — ${parts.join(' and ')}. ${below.length === 1 ? 'It is' : 'Both are'} worth a counter, not a yes.${barter ? ` ${barter.brand} is worse: ${shortInr(barter.rate.rateInr)} of work for a ${shortInr(barter.terms.fee?.inr ?? 0)} gift.` : ''}`,
    )
  }
  if (stale.length) {
    const d = stale[0]
    paragraphs.push(
      `${d.brand} wants the content by ${shortDate(d.terms.deadline.date!)} — before the email was even sent. Ask for a new window before pricing anything.`,
    )
  }
  if (blockedFit.length) {
    const names = blockedFit.map((d) => d.brand)
    paragraphs.push(
      `${names.join(' and ')} add up to ${formatInr(money.blockedInr)} you should not take: one breaches the Nova Phones exclusivity, the other your no-gambling rule.`,
    )
  }
  if (scams.length) {
    paragraphs.push(
      `${scams.length} emails are scams or phishing${scams.some((d) => d.risks.some((r) => r.code === 'prompt_injection')) ? ', including one written to instruct an AI assistant' : ''}. Report them and don't reply${spam.length ? `; the ${spam.length === 1 ? 'newsletter' : 'newsletters'} can stay unread` : ''}.`,
    )
  }

  const headline =
    money.actionableInr > 0
      ? `${shortInr(money.actionableInr)} is worth a reply today. ${shortInr(money.blockedInr)} is not, at any price.`
      : 'Nothing in this inbox is worth money today.'

  const markdown = [
    `# Brand inbox — ${weekdayDate(profile.today)}`,
    '',
    `**${headline}**`,
    '',
    ...paragraphs.map((p) => `${p}\n`),
    '## Do first',
    ...attention.slice(0, 6).map((item, i) => {
      const deal = deals.find((d) => d.id === item.dealId)!
      return `${i + 1}. **${deal.brand} — ${item.action.replace(/_/g, ' ')}.** ${item.line}. ${deal.actionReason}`
    }),
    '',
    '## Do not reply',
    ...blocked.map((item) => {
      const deal = deals.find((d) => d.id === item.dealId)!
      return `- **${deal.brand}** — ${item.line}. ${deal.categoryReason}`
    }),
    '',
    '## Money',
    `- Offers on the table: ${formatInr(money.offeredInr)}`,
    `- Worth a reply: ${formatInr(money.actionableInr)}`,
    `- Under your rate: ${formatInr(money.belowRateInr)}`,
    `- Blocked by your rules: ${formatInr(money.blockedInr)}`,
    '',
    `_${emails.length} emails · ${deals.length} deals · nothing sent. Drafts are for review._`,
  ].join('\n')

  return {
    headline,
    paragraphs,
    attention,
    blocked,
    counts: { emails: emails.length, deals: deals.length, byCategory, byAction },
    money,
    markdown,
  }
}

/**
 * The whole pipeline. Emails in, one analysis out — used by the CLI, the
 * evaluation script and the browser, so all three cannot disagree.
 */
/**
 * A follow-up that says "same deliverables" is not a thin brief — it is a
 * continuation. Judge it with the thread behind it, but only when it clearly
 * refers backwards and the previous email had a real offer.
 */
function applyThreadContext(emails: EmailAnalysis[]) {
  const groups = new Map<string, EmailAnalysis[]>()
  for (const email of emails) {
    const list = groups.get(email.brandKey) ?? []
    list.push(email)
    groups.set(email.brandKey, list)
  }
  for (const thread of groups.values()) {
    const ordered = [...thread].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    for (let i = 1; i < ordered.length; i++) {
      const email = ordered[i]
      const previous = ordered[i - 1]
      const refersBack = /following up|same deliverables|as discussed|earlier email|previous email|our offer|revised internally|on behalf of/i.test(email.body)
      if (email.category === 'needs_more_info' && !email.deliverables.length && refersBack && previous.category === 'deal_offer') {
        email.category = 'deal_offer'
        email.categoryReason = 'A follow-up on the same thread. The deliverables and terms were stated earlier; the newest email changes the fee.'
      }
    }
  }
  return emails
}

export function analyzeInbox(
  inbox: InboxEmail[],
  profile: CreatorProfile,
  overrides: Record<string, CategoryOverride> = {},
): Analysis {
  const emails = applyThreadContext(inbox.map((email) => extractEmail(email, profile, overrides[email.id])))

  const groups = new Map<string, EmailAnalysis[]>()
  for (const email of emails) {
    const list = groups.get(email.brandKey) ?? []
    list.push(email)
    groups.set(email.brandKey, list)
  }

  const ordered = [...groups.entries()]
    .map(([key, list]) => ({ key, emails: [...list].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)) }))
    .sort((a, b) => a.emails[0].receivedAt.localeCompare(b.emails[0].receivedAt))

  const deals: Deal[] = ordered.map(({ key, emails: thread }, index) => {
    const latest = thread[thread.length - 1]
    const terms = mergeTerms(thread)
    const rate = compareRate(terms, profile)
    const risks = assessRisks(latest.category, terms, rate, thread, profile)
    const { action, reason } = decideAction(latest.category, terms, risks, rate)

    const fees = thread.flatMap((e) => (e.fee ? [e.fee.inr] : []))
    const latestFee = terms.fee?.inr ?? null
    const priorMax = fees.length > 1 ? Math.max(...fees.slice(0, -1)) : null
    const feeCut = latestFee !== null && priorMax !== null && priorMax > latestFee ? priorMax - latestFee : null
    const deliverablesChanged = new Set(thread.map((e) => JSON.stringify(e.deliverables))).size > 1

    const deal: Deal = {
      id: `D-${String(index + 1).padStart(2, '0')}`,
      brand: latest.brand,
      brandKey: key,
      emails: thread,
      latestEmailId: latest.id,
      category: latest.category,
      categoryReason: latest.categoryReason,
      terms,
      rate,
      risks,
      riskScore: 0,
      action,
      actionReason: reason,
      draft: null,
      summary: oneLineSummary(latest.category, terms, rate, action),
      priority: 0,
      termsChanged: feeCut !== null || deliverablesChanged,
      feeCut,
    }
    deal.riskScore = Math.min(100, risks.reduce((n, r) => n + (r.severity === 'high' ? 34 : r.severity === 'medium' ? 18 : 6), 0))
    deal.priority = priorityFor(deal, profile)
    deal.draft = buildDraft(deal, profile)
    return deal
  })

  return {
    generatedAt: new Date().toISOString(),
    today: profile.today,
    profile,
    emails,
    deals,
    summary: buildSummary(deals, emails, profile),
  }
}
