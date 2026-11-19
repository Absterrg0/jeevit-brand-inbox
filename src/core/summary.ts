/** The creator-facing brief. Templated, so it says exactly what the analysis says. */
import type { Deal, EmailResult, Profile } from '../types'
import { daysBetween, formatDate } from './dates'
import { formatInr } from './money'
import { describeDeliverables, REPLY_ACTIONS } from './policy'

const VERB: Record<Deal['action'], string> = {
  accept: 'Accept',
  negotiate: 'Negotiate',
  ask_for_details: 'Ask for details',
  decline: 'Decline',
  ignore: 'Ignore',
  report: 'Report',
  review_manually: 'Read it yourself',
}

function line(deal: Deal, today: string): string {
  const t = deal.terms
  const offer = t.fee
    ? `${formatInr(t.fee.inr)}${t.fee.currency === 'USD' ? ` (${t.fee.text})` : ''}`
    : t.giftValue
      ? `product worth ${formatInr(t.giftValue.inr)}`
      : null
  const scope = t.deliverables.length ? describeDeliverables(t) : null
  const days = t.deadline?.date ? daysBetween(today, t.deadline.date) : null
  const due = t.deadline?.date ? ` Due ${formatDate(t.deadline.date)}${days !== null && days >= 0 ? ` (${days} days)` : ''}.` : ''
  const what = offer && scope ? ` ${offer.charAt(0).toUpperCase()}${offer.slice(1)} for ${scope}.` : ''
  return `**${deal.brand}: ${VERB[deal.action].toLowerCase()}.**${what} ${deal.why}${due} _(${deal.emailIds.join(', ')})_`
}

export function buildSummary(deals: Deal[], emails: EmailResult[], profile: Profile, usdToInr: number): string {
  const reply = deals.filter((d) => REPLY_ACTIONS.has(d.action) && d.action !== 'decline')
  const decline = deals.filter((d) => d.action === 'decline')
  const manual = deals.filter((d) => d.action === 'review_manually')
  const report = deals.filter((d) => d.action === 'report')
  const ignore = deals.filter((d) => d.action === 'ignore')
  const onTable = reply.reduce((sum, d) => sum + (d.terms.fee?.inr ?? 0), 0)
  const atCounter = reply.reduce((sum, d) => sum + (d.counter ? (d.counter.currency === 'USD' ? d.counter.amount * usdToInr : d.counter.amount) : (d.terms.fee?.inr ?? 0)), 0)

  const out: string[] = []
  out.push(`# ${profile.name.split(' ')[0]}'s brand inbox: ${formatDate(profile.today)}`)
  out.push('')
  out.push(
    `${emails.length} emails, ${deals.length} separate conversations. **${reply.length} need a reply from you**, ${decline.length} to decline, ${report.length + ignore.length} to leave alone.`,
  )
  if (manual.length) {
    out.push('', '## Could not be analysed', '')
    for (const d of manual) out.push(`- **${d.brand}** _(${d.emailIds.join(', ')})_: the model did not return a usable answer. Read this one yourself.`)
  }
  if (reply.length) {
    out.push('', '## Reply to these', '')
    reply.forEach((d, i) => out.push(`${i + 1}. ${line(d, profile.today)}`))
  }
  if (decline.length) {
    out.push('', '## Decline politely', '')
    for (const d of decline) out.push(`- ${line(d, profile.today)}`)
  }
  if (report.length) {
    out.push('', '## Do not reply, click or pay', '')
    for (const d of report) out.push(`- **${d.brand}** _(${d.emailIds.join(', ')})_: ${d.why}`)
  }
  if (ignore.length) {
    out.push('', '## Nothing to do', '')
    for (const d of ignore) out.push(`- **${d.brand}** _(${d.emailIds.join(', ')})_: ${d.why}`)
  }
  if (onTable) {
    out.push('', '## Money', '')
    out.push(`Offers you could say yes to add up to **${formatInr(onTable)}** as written${atCounter > onTable ? `, or **${formatInr(atCounter)}** if your counters land` : ''}.`)
  }
  out.push('', '_Drafts are suggestions for you to review. Nothing has been sent._')
  return out.join('\n')
}
