/**
 * The whole pipeline, in the order it runs:
 *
 *   1. model   extract facts from each email            (llm/extract.ts)
 *      model   answer one yes/no question per rule      (llm/check.ts)
 *   2. code    verify quotes, parse money and dates     (core/facts.ts)
 *   3. code    group emails into deals, latest terms    (core/deals.ts)
 *   4. code    category, risk flags against profile     (core/deals.ts, core/risk.ts)
 *   5. code    action, counter-offer, reply points      (core/policy.ts)
 *   6. model   word the reply from those points         (llm/draft.ts)
 *   7. code    check the draft, build the summary       (core/draftGuard.ts, core/summary.ts)
 */
import { displayBrand } from './core/brand'
import { categorise, groupEmails, mergeTerms, pickContact } from './core/deals'
import { safeName, templateDraft } from './core/draftGuard'
import { buildFacts, type EmailFacts } from './core/facts'
import { replyLanguage } from './core/language'
import { counterOffer, decideAction, explain, rankDeals, replyPoints, REPLY_ACTIONS } from './core/policy'
import { derivePolicy, firstName } from './core/profile'
import { buildFlags, findBlocks, rateCheck } from './core/risk'
import { buildSummary } from './core/summary'
import { CHECK_PROMPT_VERSION, checkEmail } from './llm/check'
import { DRAFT_PROMPT_VERSION, writeDraft } from './llm/draft'
import { extractEmail, EXTRACT_PROMPT_VERSION } from './llm/extract'
import type { RecordedLlm } from './llm/recordings'
import type { Analysis, Deal, Email, EmailResult, Profile } from './types'

export interface RunOptions {
  /** Skip model call 2 and use template drafts. Used by the variance runs, which only score extraction. */
  skipDrafts?: boolean
  temperature?: number
  onProgress?: (message: string) => void
}

export async function analyseInbox(emails: Email[], profile: Profile, llm: RecordedLlm, options: RunOptions = {}): Promise<Analysis> {
  const policy = derivePolicy(profile)
  const say = options.onProgress ?? (() => {})

  // 1 + 2. One email at a time: free tiers and local models are both rate-limited.
  const facts: EmailFacts[] = []
  const errors = new Map<string, string>()
  for (const email of emails) {
    say(`reading ${email.id}`)
    const { extraction, error } = await extractEmail(llm, email, profile, { temperature: options.temperature })
    if (error) errors.set(email.id, error)
    // Only real outreach is worth checking against the rules; newsletters and notices are not offers.
    let check = null
    if (extraction?.email_kind === 'brand_outreach') {
      const checked = await checkEmail(llm, email, profile, { temperature: options.temperature })
      check = checked.result
      if (checked.error) errors.set(email.id, checked.error)
    }
    facts.push(buildFacts(email, extraction, profile, policy, check))
  }

  // 3–5.
  const emailResults = new Map<string, EmailResult>()
  const deals: Deal[] = []
  const pendingDrafts: { deal: Deal; points: string[]; language: string }[] = []

  groupEmails(facts).forEach((group, index) => {
    const dealId = `D-${String(index + 1).padStart(2, '0')}`

    // Each email is categorised on the thread as it stood when that email arrived.
    group.forEach((f, i) => {
      const thread = group.slice(0, i + 1)
      const { terms } = mergeTerms(thread)
      const blocks = findBlocks(thread, terms, profile)
      const { category, reason } = categorise(f, thread, terms, { rule: blocks.rule.length > 0, exclusivity: blocks.exclusivity.length > 0 })
      emailResults.set(f.email.id, {
        id: f.email.id,
        receivedAt: f.email.received_at,
        from: f.email.from,
        subject: f.email.subject,
        body: f.email.body,
        status: f.extraction ? 'ok' : 'failed',
        category,
        categoryReason: errors.get(f.email.id) ?? reason,
        modelCategory: f.extraction?.suggested_category ?? null,
        dealId,
        language: replyLanguage(f.email.body, profile),
        summary: f.extraction?.summary ?? null,
        extraction: f.extraction,
        signals: f.signals,
        promotes: f.promotes,
        rulesChecked: f.rulesChecked,
        droppedClaims: f.droppedClaims,
      })
    })

    const latest = group[group.length - 1]
    const { terms, history } = mergeTerms(group)
    const blocks = findBlocks(group, terms, profile)
    const { category, reason } = categorise(latest, group, terms, { rule: blocks.rule.length > 0, exclusivity: blocks.exclusivity.length > 0 })
    const rate = rateCheck(terms, profile)
    const flags = buildFlags({ category, thread: group, terms, history, rate, blocks, profile, policy })
    const action = decideAction(category, flags)
    const counter = counterOffer(terms, rate, history, flags, policy)
    const named = [...group].reverse().find((f) => f.extraction?.brand ?? f.extraction?.sender_org)?.extraction
    const brand = safeName(named?.brand ?? named?.sender_org) ?? displayBrand(null, group[0].email.from)

    const deal: Deal = {
      id: dealId,
      brand,
      contact: pickContact(group),
      emailIds: group.map((f) => f.email.id),
      latestEmailId: latest.email.id,
      category,
      action,
      why: explain(action, category, flags, reason),
      rank: 0,
      terms,
      history,
      rate,
      counter,
      flags,
      draft: null,
    }
    deals.push(deal)

    if (REPLY_ACTIONS.has(action)) {
      const points = replyPoints({ action, terms, flags, rate, counter, history, blocks, profile, policy })
      pendingDrafts.push({ deal, points, language: replyLanguage(latest.email.body, profile) })
    }
  })

  // 6 + 7. Only deals the policy says deserve a reply get one. A scam never reaches this loop.
  for (const { deal, points, language } of pendingDrafts) {
    const contactName = safeName(deal.contact.name)?.split(' ')[0] ?? null
    const request = { label: `draft ${deal.id} ${deal.brand}`, action: deal.action, brand: deal.brand, contactName, language, signature: firstName(profile), points }
    say(`drafting reply for ${deal.brand}`)
    const draft = options.skipDrafts
      ? { body: templateDraft({ greetingName: contactName, points, signature: request.signature }), source: 'template' as const }
      : await writeDraft(llm, request)
    const latestSubject = emailResults.get(deal.latestEmailId)!.subject
    deal.draft = { subject: /^re:/i.test(latestSubject) ? latestSubject : `Re: ${latestSubject}`, body: draft.body, language: draft.source === 'model' ? language : 'English', source: draft.source }
  }

  const ranked = rankDeals(deals)
  const orderedEmails = emails.map((e) => emailResults.get(e.id)!)
  return {
    generatedFor: profile.name,
    today: profile.today,
    emails: orderedEmails,
    deals: ranked,
    summaryMarkdown: buildSummary(ranked, orderedEmails, profile, policy.usdToInr),
    stats: {
      mode: llm.mode === 'replay' ? 'replay' : 'live',
      provider: [...llm.log.providers].join(', ') || 'none',
      model: [...llm.log.models].join(', ') || 'none',
      promptVersion: `${EXTRACT_PROMPT_VERSION}, ${CHECK_PROMPT_VERSION}, ${DRAFT_PROMPT_VERSION}`,
      calls: llm.log.calls,
      failures: llm.log.failures,
      retries: llm.log.retries,
      promptTokens: llm.log.promptTokens,
      completionTokens: llm.log.completionTokens,
      recordedLatencyMs: llm.log.recordedLatencyMs,
    },
  }
}
