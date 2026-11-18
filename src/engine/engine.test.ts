import { describe, expect, it } from 'vitest'
import { ANALYSIS, INBOX, PROFILE } from './dataset'
import { analyzeInbox } from './analyze'
import { parseDeadline, parseDeliverables, parseUsage } from './text'
import { evaluate } from '../eval/score'

const byId = (id: string) => ANALYSIS.emails.find((e) => e.id === id)!
const deal = (key: string) => ANALYSIS.deals.find((d) => d.brandKey === key)!

describe('money, dates and deliverables', () => {
  it('reads Indian digit grouping and short forms', () => {
    const dew = byId('E-01').fee
    expect(dew).toMatchObject({ amount: 120_000, currency: 'INR', inr: 120_000, basis: 'cash' })
    expect(byId('E-06').fee?.inr).toBe(25_000)
    expect(byId('E-12').fee?.inr).toBe(45_000)
    expect(byId('E-05').fee?.inr).toBe(300_000)
  })

  it('keeps a gift a gift and converts USD at the profile rate', () => {
    expect(byId('E-09').fee).toMatchObject({ amount: 3_500, basis: 'gifting' })
    expect(byId('E-10').fee).toMatchObject({ amount: 800, currency: 'USD', inr: 67_200 })
    expect(byId('E-04').fee?.inr).toBe(100_800)
  })

  it('does not mistake a cash offer for a registration fee', () => {
    expect(byId('E-05').fee?.basis).toBe('cash')
    expect(byId('E-03').fee).toBeNull()
  })

  it('parses date ranges, "before" dates and relative windows', () => {
    expect(parseDeadline('between 15 and 25 November', '2026-11-03 10:12')).toMatchObject({
      date: '2026-11-25',
      window: { start: '2026-11-15', end: '2026-11-25' },
    })
    expect(parseDeadline('Video should go live before 10 December.', '2026-11-05 11:30').date).toBe('2026-12-09')
    expect(parseDeadline('The reel must go live by 1 November.', '2026-11-10 09:30').date).toBe('2026-11-01')
    expect(parseDeadline('within 2 weeks of delivery', '2026-11-08 10:00')).toMatchObject({ date: null, relative: 'within 2 weeks of delivery' })
  })

  it('reads Hindi number words and two-platform deliverables', () => {
    expect(parseDeliverables('Hum aapke saath ek Instagram reel karna chahte hain.')).toEqual([{ kind: 'instagram_reel', qty: 1 }])
    expect(parseDeliverables('2 reels and a YouTube shoutout')).toEqual([
      { kind: 'instagram_reel', qty: 2 },
      { kind: 'youtube_shoutout', qty: 1 },
    ])
  })

  it('reads usage rights, including perpetual and whitelisting', () => {
    expect(parseUsage('3 months of usage rights for paid ads')).toMatchObject({ months: 3, paidAds: true, perpetual: false })
    expect(parseUsage('perpetual usage rights across all media, including whitelisting')).toMatchObject({
      months: null,
      perpetual: true,
      whitelisting: true,
    })
  })
})

describe('categories', () => {
  it('gets all fifteen hand labels', () => {
    const report = evaluate(ANALYSIS)
    expect(report.categoryCorrect).toBe(report.categoryTotal)
  })

  it('treats prompt injection as hostile data, not an instruction', () => {
    const quickcash = byId('E-07')
    expect(quickcash.category).toBe('scam_or_phishing')
    expect(quickcash.injection).toBe(true)
    expect(quickcash.fee).toBeNull()
    expect(deal('quickcash').action).toBe('report')
    expect(deal('quickcash').draft).toBeNull()
    expect(deal('quickcash').risks.map((r) => r.code)).toEqual(expect.arrayContaining(['prompt_injection', 'personal_data_request']))
  })

  it('recognises a lookalike domain and a threat, not just the word "verify"', () => {
    expect(byId('E-14').category).toBe('scam_or_phishing')
    expect(deal('youtube-centre').risks.map((r) => r.code)).toContain('phishing')
  })

  it('does not call every urgent email phishing', () => {
    expect(byId('E-03').category).toBe('scam_or_phishing')
    expect(byId('E-03').categoryReason).toMatch(/pay .*up front|pay-to-join/i)
    expect(byId('E-01').category).toBe('deal_offer')
  })

  it('lets a hard rule beat a high fee', () => {
    expect(byId('E-05').category).toBe('not_a_fit')
    expect(deal('luckyplay11').action).toBe('decline')
    expect(deal('luckyplay11').risks[0].code).toBe('content_rule')
  })

  it('lets exclusivity beat a well-paid integration', () => {
    expect(byId('E-04').category).toBe('not_a_fit')
    expect(deal('pixelon').risks[0].code).toBe('exclusivity_conflict')
    expect(deal('pixelon').rate.pct).toBeGreaterThan(0)
  })

  it('inherits the thread for a follow-up that refers backwards', () => {
    expect(byId('E-02').category).toBe('deal_offer')
  })
})

describe('deals, not emails', () => {
  it('groups the two Dew Lab emails and the agency follow-up', () => {
    const dew = deal('dewlab')
    expect(dew.emails.map((e) => e.id)).toEqual(['E-01', 'E-02', 'E-11'])
    expect(dew.rate.rateInr).toBe(110_000)
    expect(dew.terms.fee?.inr).toBe(100_000)
    expect(dew.feeCut).toBe(20_000)
    expect(dew.terms.deliverables).toEqual([
      { kind: 'instagram_reel', qty: 2 },
      { kind: 'instagram_story', qty: 3 },
    ])
    expect(dew.terms.deadline.date).toBe('2026-11-25')
    expect(dew.action).toBe('negotiate')
    expect(dew.draft?.body).toContain('₹1,10,000')
  })

  it('uses the latest terms but falls back for fields a follow-up leaves out', () => {
    const dew = deal('dewlab')
    expect(dew.terms.contactName).toBe('Arjun')
    expect(dew.terms.usage.months).toBe(3)
    expect(dew.terms.notes).toEqual(expect.arrayContaining(['GST details requested']))
  })

  it('scores every hand-labelled field', () => {
    const report = evaluate(ANALYSIS)
    expect(report.exactDeals).toBe(report.totalDeals)
    expect(report.checksPassed).toBe(report.checksTotal)
  })
})

describe('judgment', () => {
  it('calls out the barter as unpaid work', () => {
    expect(deal('brewbox').action).toBe('decline')
    expect(deal('brewbox').risks.map((r) => r.code)).toContain('gifting_undervalued')
  })

  it('prices perpetual rights instead of accepting them', () => {
    expect(deal('auralbuds').action).toBe('negotiate')
    expect(deal('auralbuds').draft?.body).toContain('$1,400')
  })

  it('asks for a new date when the date has passed', () => {
    expect(deal('snapmeal').risks.map((r) => r.code)).toContain('impossible_deadline')
    expect(deal('snapmeal').draft?.body).toMatch(/already passed/i)
  })

  it('asks in Hindi when the creator was written to in Hindi', () => {
    expect(deal('chaiandco').draft?.language).toBe('Hindi')
    expect(deal('chaiandco').draft?.body).toContain('₹40,000')
  })

  it('never sends anything, and never includes personal data in a draft', () => {
    for (const d of ANALYSIS.deals) {
      if (!d.draft) continue
      expect(d.draft.body).not.toMatch(/\+91|home address|aadhaar|passport/i)
      expect(d.draft.body).not.toMatch(/5,00,000/)
    }
  })

  it('refuses an override that would downgrade a scam', () => {
    const forced = analyzeInbox(INBOX, PROFILE, { 'E-14': { category: 'deal_offer', reason: 'trust me' } })
    expect(forced.emails.find((e) => e.id === 'E-14')?.category).toBe('scam_or_phishing')
  })

  it('allows an override on an ambiguous email only', () => {
    const forced = analyzeInbox(INBOX, PROFILE, { 'E-08': { category: 'spam', reason: 'template blast' } })
    expect(forced.emails.find((e) => e.id === 'E-08')?.category).toBe('spam')
    expect(forced.emails.find((e) => e.id === 'E-14')?.category).toBe('scam_or_phishing')
  })
})
