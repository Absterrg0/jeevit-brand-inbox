import type { Action, Category } from '../engine/types'

/**
 * Hand-written expected answers, written before the engine was finished and
 * then used to tune it. That makes this a specification check, not a held-out
 * benchmark — the README says so plainly, and the debatable calls are listed.
 */
export interface ExpectedEmail {
  id: string
  category: Category
  note?: string
}

export interface ExpectedDeal {
  brandKey: string
  brand: string
  category: Category
  /** Fee converted at the profile's 1 USD = 84 INR. Null when there is no real offer. */
  feeInr: number | null
  currency: 'INR' | 'USD' | null
  deliverables: Record<string, number>
  deadline: string | null
  usageMonths: number | null
  perpetual: boolean
  groupSize: number
  action: Action
  /** The risk codes that must be present for this deal to be judged correctly. */
  keyRisks: string[]
  /** Where a careful human could reasonably label this differently. */
  debatable?: string
}

export const EXPECTED_EMAILS: ExpectedEmail[] = [
  { id: 'E-01', category: 'deal_offer' },
  { id: 'E-02', category: 'deal_offer', note: 'Follow-up with a revised fee; still part of the Dew Lab deal.' },
  { id: 'E-03', category: 'scam_or_phishing', note: 'Pay-to-join ambassador programme.' },
  { id: 'E-04', category: 'not_a_fit', note: 'Real offer, blocked by the Nova Phones exclusivity.' },
  { id: 'E-05', category: 'not_a_fit', note: 'Real offer, blocked by the gambling rule.' },
  { id: 'E-06', category: 'needs_more_info', note: 'Has a fee and a deliverable but no timeline or usage. Debatable: a strict reader could call this a below-rate deal_offer.' },
  { id: 'E-07', category: 'scam_or_phishing', note: 'Prompt injection, no real offer.' },
  { id: 'E-08', category: 'needs_more_info', note: 'No fee, deliverables or dates. Debatable: spam.' },
  { id: 'E-09', category: 'deal_offer', note: 'Barter is an offer under the brief. Debatable: not_a_fit because the gift is far below the work.' },
  { id: 'E-10', category: 'deal_offer', note: 'Real offer with a usage-rights problem, which is a risk, not a category.' },
  { id: 'E-11', category: 'deal_offer', note: 'Agency email for the same Dew Lab deal.' },
  { id: 'E-12', category: 'needs_more_info', note: 'The go-live date is in the past. Debatable: not_a_fit, since the brief cannot be delivered as written.' },
  { id: 'E-13', category: 'spam' },
  { id: 'E-14', category: 'scam_or_phishing', note: 'Lookalike domain, credential phishing.' },
  { id: 'E-15', category: 'needs_more_info', note: 'Referenced brief is missing; no terms in the body.' },
]

export const EXPECTED_DEALS: ExpectedDeal[] = [
  {
    brandKey: 'dewlab',
    brand: 'Dew Lab',
    category: 'deal_offer',
    feeInr: 100_000,
    currency: 'INR',
    deliverables: { instagram_reel: 2, instagram_story: 3 },
    deadline: '2026-11-25',
    usageMonths: 3,
    perpetual: false,
    groupSize: 3,
    action: 'negotiate',
    keyRisks: ['below_rate'],
  },
  {
    brandKey: 'glowstar',
    brand: 'Glowstar',
    category: 'scam_or_phishing',
    feeInr: null,
    currency: null,
    deliverables: {},
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'report',
    keyRisks: ['pay_to_join'],
  },
  {
    brandKey: 'pixelon',
    brand: 'Pixelon',
    category: 'not_a_fit',
    feeInr: 100_800,
    currency: 'USD',
    deliverables: { youtube_integration: 1 },
    deadline: '2026-12-09',
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'decline',
    keyRisks: ['exclusivity_conflict'],
  },
  {
    brandKey: 'luckyplay11',
    brand: 'LuckyPlay11',
    category: 'not_a_fit',
    feeInr: 300_000,
    currency: 'INR',
    deliverables: { instagram_reel: 2, youtube_shoutout: 1 },
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'decline',
    keyRisks: ['content_rule'],
  },
  {
    brandKey: 'chaiandco',
    brand: 'Chai & Co',
    category: 'needs_more_info',
    feeInr: 25_000,
    currency: 'INR',
    deliverables: { instagram_reel: 1 },
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'ask_for_details',
    keyRisks: ['below_rate'],
  },
  {
    brandKey: 'quickcash',
    brand: 'QuickCash Media',
    category: 'scam_or_phishing',
    feeInr: null,
    currency: null,
    deliverables: {},
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'report',
    keyRisks: ['prompt_injection'],
  },
  {
    brandKey: 'urbanthread',
    brand: 'Urban Thread',
    category: 'needs_more_info',
    feeInr: null,
    currency: null,
    deliverables: {},
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'ask_for_details',
    keyRisks: [],
  },
  {
    brandKey: 'brewbox',
    brand: 'BrewBox',
    category: 'deal_offer',
    feeInr: 3_500,
    currency: 'INR',
    deliverables: { instagram_reel: 1, instagram_story: 2 },
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'decline',
    keyRisks: ['gifting_undervalued'],
  },
  {
    brandKey: 'auralbuds',
    brand: 'AuralBuds',
    category: 'deal_offer',
    feeInr: 67_200,
    currency: 'USD',
    deliverables: { instagram_reel: 1 },
    deadline: '2026-11-30',
    usageMonths: null,
    perpetual: true,
    groupSize: 1,
    action: 'negotiate',
    keyRisks: ['usage_buyout'],
  },
  {
    brandKey: 'snapmeal',
    brand: 'SnapMeal',
    category: 'needs_more_info',
    feeInr: 45_000,
    currency: 'INR',
    deliverables: { instagram_reel: 1 },
    deadline: '2026-11-01',
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'ask_for_details',
    keyRisks: ['impossible_deadline'],
  },
  {
    brandKey: 'creatorweekly',
    brand: 'Creator Weekly',
    category: 'spam',
    feeInr: null,
    currency: null,
    deliverables: {},
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'ignore',
    keyRisks: [],
  },
  {
    brandKey: 'youtube-centre',
    brand: 'YouTube Copyright Centre',
    category: 'scam_or_phishing',
    feeInr: null,
    currency: null,
    deliverables: {},
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'report',
    keyRisks: ['phishing'],
  },
  {
    brandKey: 'fitnest',
    brand: 'FitNest',
    category: 'needs_more_info',
    feeInr: null,
    currency: null,
    deliverables: {},
    deadline: null,
    usageMonths: null,
    perpetual: false,
    groupSize: 1,
    action: 'ask_for_details',
    keyRisks: ['missing_attachment'],
  },
]

/**
 * What the score would be under the alternative readings listed above.
 * Reported so the 15/15 is not mistaken for a held-out result.
 */
export const ALTERNATIVE_LABELS: Record<string, Category> = {
  'E-06': 'deal_offer',
  'E-09': 'not_a_fit',
  'E-12': 'not_a_fit',
}
