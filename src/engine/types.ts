/**
 * The shape of everything the engine produces. Kept deliberately plain data so
 * the CLI can write it to JSON and the UI can render it without a second model.
 */

export type Category = 'deal_offer' | 'needs_more_info' | 'not_a_fit' | 'scam_or_phishing' | 'spam'

export type Action = 'accept' | 'negotiate' | 'ask_for_details' | 'decline' | 'ignore' | 'report'

export type Severity = 'high' | 'medium' | 'low'

export type DeliverableKind =
  | 'instagram_reel'
  | 'instagram_story'
  | 'youtube_integration'
  | 'youtube_dedicated_video'
  | 'youtube_shoutout'

export interface Deliverable {
  kind: DeliverableKind
  qty: number
}

export type Currency = 'INR' | 'USD'
export type PaymentBasis = 'cash' | 'gifting' | 'none'

export interface Money {
  /** The figure as quoted (in `currency`). */
  amount: number
  currency: Currency
  /** Converted for comparison, using the creator's stated 1 USD = 84 INR. */
  inr: number
  basis: PaymentBasis
  /** Where the number came from, e.g. "Budget 25k". */
  quote?: string
}

export interface Usage {
  months: number | null
  perpetual: boolean
  paidAds: boolean
  whitelisting: boolean
  raw: string | null
}

export interface Deadline {
  /** ISO date the content must be live by, when the email states or implies one. */
  date: string | null
  /** e.g. "within 2 weeks of delivery" — real, but not a calendar date. */
  relative: string | null
  /** The window named by a campaign brief, e.g. "15–25 Nov". */
  window?: { start: string; end: string } | null
  raw: string | null
}

export interface Extraction {
  brand: string
  contactName: string | null
  platform: 'instagram' | 'youtube' | 'both' | null
  deliverables: Deliverable[]
  fee: Money | null
  deadline: Deadline
  usage: Usage
  /** Any other term worth surfacing: GST details, exclusivity, shipping, etc. */
  notes: string[]
}

export interface RiskFlag {
  code: RiskCode
  severity: Severity
  title: string
  /** The "why", in the creator's language. Always grounded in the profile or the email. */
  why: string
  evidence?: string
}

export type RiskCode =
  | 'below_rate'
  | 'gifting_undervalued'
  | 'exclusivity_conflict'
  | 'content_rule'
  | 'usage_buyout'
  | 'impossible_deadline'
  | 'tight_deadline'
  | 'incomplete_brief'
  | 'missing_attachment'
  | 'pay_to_join'
  | 'prompt_injection'
  | 'phishing'
  | 'personal_data_request'
  | 'urgency_pressure'
  | 'unrealistic_promise'
  | 'bulk_mail'

export interface DraftReply {
  subject: string
  body: string
  language: 'English' | 'Hindi'
  /** One line the UI shows above the draft. */
  note: string
}

export interface EmailAnalysis extends Extraction {
  id: string
  brandKey: string
  receivedAt: string
  from: string
  subject: string
  body: string
  category: Category
  categoryReason: string
  /** True when the email tries to instruct an AI assistant. Never obeyed. */
  injection: boolean
  /** Named facts the rules matched, kept for the evidence trail. */
  matches: string[]
}

export interface RateComparison {
  /** Sum of the creator's base rates for the extracted deliverables. */
  rateInr: number
  offeredInr: number | null
  deltaInr: number | null
  /** Positive means the offer is above the creator's rate. */
  pct: number | null
  /** Set when a deliverable has no rate card entry and a proxy was used. */
  proxyFor?: DeliverableKind[]
}

export interface Deal {
  id: string
  brand: string
  brandKey: string
  /** Every email about this deal, oldest first. */
  emails: EmailAnalysis[]
  latestEmailId: string
  category: Category
  categoryReason: string
  /** Latest stated terms, field by field. */
  terms: Extraction
  rate: RateComparison
  risks: RiskFlag[]
  riskScore: number
  action: Action
  actionReason: string
  draft: DraftReply | null
  /** One sentence a creator can scan in a list. */
  summary: string
  /** 0–100, used to order "needs you today". */
  priority: number
  /** Emails differed on price or terms; the latest wins. */
  termsChanged: boolean
  /** The fee moved in the creator's disfavour across the thread. */
  feeCut: number | null
}

export interface CreatorProfile {
  name: string
  email: string
  niche: string
  languages: string[]
  platforms: {
    instagram?: { handle: string; followers: number }
    youtube?: { channel: string; subscribers: number }
  }
  base_rates_inr: Record<string, number>
  currency_note: string
  current_exclusivity: {
    brand: string
    category: string
    until: string
    terms: string
  }[]
  content_rules: string[]
  usage_rights_policy: string
  today: string
}

export interface InboxEmail {
  id: string
  received_at: string
  from: string
  subject: string
  body: string
}

export interface AttentionItem {
  dealId: string
  brand: string
  line: string
  action: Action
  severity: Severity | null
}

export interface Summary {
  headline: string
  paragraphs: string[]
  attention: AttentionItem[]
  blocked: AttentionItem[]
  counts: {
    emails: number
    deals: number
    byCategory: Record<Category, number>
    byAction: Record<Action, number>
  }
  money: {
    /** Cash offers on the table, INR, excluding scams and spam. */
    offeredInr: number
    /** Cash in deals worth replying to (accept, negotiate or ask). */
    actionableInr: number
    atOrAboveRateInr: number
    belowRateInr: number
    /** Cash the creator should not take, summarised in one figure. */
    blockedInr: number
  }
  markdown: string
}

export interface Analysis {
  generatedAt: string
  today: string
  profile: CreatorProfile
  emails: EmailAnalysis[]
  deals: Deal[]
  summary: Summary
}
