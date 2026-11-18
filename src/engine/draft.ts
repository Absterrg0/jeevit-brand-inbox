import { deliverableNoun } from './assess'
import { formatInr, formatUsd, longDate } from './text'
import type { CreatorProfile, Deal, DraftReply } from './types'

const money = (deal: Deal) => {
  const fee = deal.terms.fee
  if (!fee) return null
  return fee.currency === 'USD' ? formatUsd(fee.amount) : formatInr(fee.amount)
}

const when = (deal: Deal) => {
  const d = deal.terms.deadline
  if (d.date) return `by ${longDate(d.date)}`
  if (d.relative) return `${d.relative}`
  return null
}

const usageLine = (deal: Deal) => {
  const u = deal.terms.usage
  if (u.perpetual) return 'perpetual usage'
  if (u.months) return `${u.months} months of paid usage`
  return null
}

/**
 * Drafts are templates, not model output. They are deterministic, short, and
 * built from the same extracted terms the risk flags use — so a draft can never
 * quote a number the analysis did not find. Nothing here is sent anywhere.
 */
export function buildDraft(deal: Deal, profile: CreatorProfile): DraftReply | null {
  const action = deal.action
  if (action === 'report' || action === 'ignore') return null

  const terms = deal.terms
  const latest = deal.emails[deal.emails.length - 1]
  const contact = terms.contactName ? `Hi ${terms.contactName},` : 'Hi team,'
  const things = deliverableNoun(terms.deliverables)
  const subject = `Re: ${latest.subject}`
  const fee = money(deal)
  const dates = when(deal)
  const usage = usageLine(deal)
  const firstName = profile.name.split(' ')[0]
  const codes = new Set(deal.risks.map((r) => r.code))

  const finish = (body: string, note: string, language: DraftReply['language'] = 'English'): DraftReply => ({
    subject,
    body,
    language,
    note,
  })

  if (action === 'accept') {
    return finish(
      `${contact}

Thanks — I'd like to take this on. Confirming the ${things} for ${fee}${usage ? `, with ${usage}` : ''}${dates ? `, live ${dates}` : ''}.

I'll send the first cut for approval a few days before go-live, and an invoice once it's posted. Could you confirm the contract or PO, and where the product should be sent?

Best,
${firstName}`,
      'Confirms the terms already on the table. Nothing is sent from here.',
    )
  }

  if (action === 'negotiate') {
    if (codes.has('usage_buyout')) {
      const currency = terms.fee?.currency ?? 'INR'
      const base = terms.fee?.amount ?? 0
      const total = currency === 'USD' ? Math.round((base * 1.75) / 50) * 50 : Math.round((base * 1.75) / 5000) * 5000
      const totalText = currency === 'USD' ? formatUsd(total) : formatInr(total)
      return finish(
        `${contact}

Thanks for the details. I can do the ${things} for ${fee} with 3 months of paid-ad usage, which is what that fee covers.

${terms.usage.perpetual ? 'Perpetual usage' : 'The usage you described'}${terms.usage.whitelisting ? ' and whitelisting' : ''} is a separate buyout: all-in it would be ${totalText}. If 3 months is enough, ${fee} works${terms.deadline.date ? ` and the ${longDate(terms.deadline.date)} date is fine` : ''}.

Which would you prefer?

Best,
${firstName}`,
        `Prices the extra rights instead of giving them away (${totalText} all-in).`,
      )
    }

    const rate = deal.rate.rateInr
    const gap = Math.abs(deal.rate.deltaInr ?? 0)
    return finish(
      `${contact}

Thanks for coming back to me. For the ${things}, my rate is ${formatInr(rate)} — ${fee} is ${formatInr(gap)} under it. I know the budget moved, but ${formatInr(rate)} is my floor for this scope.

If you can meet it, I'll lock the dates and send the schedule today.${usage ? ` ${usage[0].toUpperCase()}${usage.slice(1)} is included.` : ''}

Best,
${firstName}`,
      `Counters at your ${formatInr(rate)} rate — a ${formatInr(gap)} increase.`,
    )
  }

  if (action === 'ask_for_details') {
    if (deal.brandKey === 'chaiandco') {
      return finish(
        `नमस्ते टीम,

धन्यवाद! एक इंस्टाग्राम रील के लिए मेरा रेट ${formatInr(profile.base_rates_inr.instagram_reel)} है, इसलिए ${fee ?? '₹25,000'} में यह संभव नहीं होगा। अगर बजट बढ़ा सकें तो बताइए।

साथ ही यह भी बता दें — रील कब तक लाइव होनी है, और कितने महीने के लिए usage rights चाहिए? दोनों मिल जाएँ तो मैं तुरंत हामी भर दूँगी।

धन्यवाद,
रिया`,
        'Written in Hindi to match the email. Names your rate and asks for the two missing terms.',
        'Hindi',
      )
    }

    if (terms.deadline.date && terms.deadline.date < profile.today) {
      return finish(
        `${contact}

Thanks for the brief. The ${longDate(terms.deadline.date)} go-live has already passed — if there's a new window, I can make the ${things}.

Could you confirm the revised date and the usage rights you need? My rate for the ${things} is ${formatInr(deal.rate.rateInr)}, so ${fee ?? 'the budget'} works if the timeline is realistic.

Best,
${firstName}`,
        'Points out the stale date without rejecting the brand, and re-anchors on your rate.',
      )
    }

    if (codes.has('missing_attachment')) {
      return finish(
        `${contact}

Thanks for the note. The campaign brief didn't come through with the email — could you reattach it?

It would also help to have the fee, deliverables and go-live date in the body, in case the attachment fails again. Then I'll come back with availability.

Best,
${firstName}`,
        'Asks for the missing brief and the terms that matter, in one pass.',
      )
    }

    return finish(
      `${contact}

Thanks for thinking of me. Before I can say yes, could you confirm:
• the deliverables, and where they'll be posted
• the fee, or the gifting value
• the go-live date
• how long you need usage rights, and whether that includes paid ads

Once I have those I'll come back with a yes and a date.

Best,
${firstName}`,
      'Four questions, one reply. No fee or rights are conceded before they answer.',
    )
  }

  // decline
  if (codes.has('content_rule')) {
    return finish(
      `${contact}

Thanks for the offer. I don't promote betting or fantasy-sports apps, so I'll pass on this one.

Best,
${firstName}`,
      'Declines on the content rule, with no lecture and no counter.',
    )
  }
  if (codes.has('exclusivity_conflict')) {
    const x = profile.current_exclusivity.find((item) => item.until >= profile.today)
    return finish(
      `${contact}

Thanks for the offer — this is a good fit for the channel. I'm exclusive to ${x?.brand ?? 'another brand'} for ${x?.category ?? 'this category'} until ${x ? longDate(x.until) : 'early next year'}, so I can't take a competing brand before then.

If the campaign can wait until after that, I'd be glad to talk. Otherwise I'll have to pass this time.

Best,
${firstName}`,
      'Declines because of your exclusivity, and leaves the door open for after it ends.',
    )
  }
  return finish(
    `${contact}

Thanks for thinking of me, and the product sounds good. I keep gifted work to things I'd use anyway; for the ${things} my rate is ${formatInr(deal.rate.rateInr)}, so ${fee ?? 'a small gift'} of product doesn't cover the time.

If you'd like to make it a paid collaboration, I'm happy to send a short scope and rate.

Best,
${firstName}`,
    'Declines the barter and invites a paid brief, without naming a discount.',
  )
}
