/**
 * Every shape that crosses a boundary, as Zod schemas.
 *
 *   Email, Profile      the supplied input files
 *   Extraction          what the model is allowed to say about one email
 *   Analysis            what the pipeline writes to out/analysis.json (CLI, eval and UI all read this)
 *
 * The model's output is the only untrusted-derived structure in the system, so
 * `Extraction` is deliberately narrow: enums, small integers, and short strings.
 * It contains no category the code must obey and no action.
 */
import { z } from 'zod'

// ───────────────────────────── inputs ─────────────────────────────

export const EmailSchema = z.object({
  id: z.string(),
  received_at: z.string(),
  from: z.string(),
  subject: z.string(),
  body: z.string(),
})
export type Email = z.infer<typeof EmailSchema>

export const ProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  niche: z.string(),
  languages: z.array(z.string()),
  platforms: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number()]))),
  base_rates_inr: z.record(z.string(), z.number()),
  currency_note: z.string(),
  current_exclusivity: z.array(z.object({ brand: z.string(), category: z.string(), until: z.string(), terms: z.string() })),
  content_rules: z.array(z.string()),
  usage_rights_policy: z.string(),
  today: z.string(),
})
export type Profile = z.infer<typeof ProfileSchema>

// ───────────────────────────── shared enums ─────────────────────────────

export const CATEGORIES = ['deal_offer', 'needs_more_info', 'not_a_fit', 'scam_or_phishing', 'spam'] as const
export type Category = (typeof CATEGORIES)[number]

export const ACTIONS = ['accept', 'negotiate', 'ask_for_details', 'decline', 'ignore', 'report', 'review_manually'] as const
export type Action = (typeof ACTIONS)[number]

export const DELIVERABLE_TYPES = [
  'instagram_reel',
  'instagram_story',
  'instagram_post',
  'youtube_integration',
  'youtube_dedicated_video',
  'youtube_short',
  'other',
] as const
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number]

export const RED_FLAG_TYPES = [
  'upfront_payment',
  'credential_or_verification_link',
  'instructions_to_ai',
  'personal_info_request',
  'urgency_pressure',
  'impersonation',
  'too_good_to_be_true',
] as const
export type RedFlagType = (typeof RED_FLAG_TYPES)[number]

// ───────────────────────────── model output ─────────────────────────────

/** Small models write "null", "", or omit a key interchangeably. Treat them all as null. */
const blankToNull = (v: unknown) => (v === undefined || v === '' || v === 'null' || v === 'none' ? null : v)
const text = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable())
const int = (min: number, max: number) => z.preprocess(blankToNull, z.coerce.number().int().min(min).max(max).nullable())
const list = <T extends z.ZodType>(item: T, max: number) => z.preprocess((v) => v ?? [], z.array(item).max(max))

export const ExtractionSchema = z.object({
  email_kind: z.enum(['brand_outreach', 'newsletter_or_bulk', 'account_or_security_notice', 'other']),
  /** The model's own guess at the final category. Recorded and scored, never obeyed. */
  suggested_category: z.enum(CATEGORIES),
  language: text(30),
  summary: text(240),
  brand: text(60),
  sender_name: text(60),
  sender_org: text(60),
  product: text(120),
  deliverables: list(
    z.object({
      type: z.enum(DELIVERABLE_TYPES).catch('other'),
      count: z.coerce.number().int().min(1).max(50).catch(1),
    }),
    10,
  ),
  payment_type: z.enum(['cash', 'gifting', 'cash_and_gifting', 'commission_only', 'not_stated']).catch('not_stated'),
  /** Copied from the email, e.g. "INR 1,20,000" or "25k". Code parses the number. */
  fee_text: text(60),
  gift_value_text: text(60),
  deadline: z.preprocess(
    blankToNull,
    z
      .object({ text: text(100), day: int(1, 31), month: int(1, 12), year: int(2000, 2100) })
      .nullable(),
  ),
  usage_rights: z.preprocess(
    blankToNull,
    z
      .object({
        text: text(160),
        months: int(0, 600),
        perpetual: z.boolean().catch(false),
        paid_ads: z.boolean().catch(false),
        whitelisting: z.boolean().catch(false),
      })
      .nullable(),
  ),
  other_terms: list(z.string().trim().max(120), 5),
  /** Index into profile.content_rules, plus the words in the email that show it. */
  rule_conflicts: list(z.object({ rule: z.coerce.number().int().min(0).max(50), quote: z.string().max(200) }), 5),
  /** Index into profile.current_exclusivity. */
  exclusivity_conflicts: list(z.object({ exclusivity: z.coerce.number().int().min(0).max(50), quote: z.string().max(200) }), 5),
  red_flags: list(z.object({ type: z.enum(RED_FLAG_TYPES), quote: z.string().max(200) }), 8),
})
export type Extraction = z.infer<typeof ExtractionSchema>

export const DraftSchema = z.object({ body: z.string().trim().min(20).max(1600) })

// ───────────────────────────── pipeline output ─────────────────────────────

export type Severity = 'high' | 'medium' | 'low'

export type FlagCode =
  | 'below_rate'
  | 'gifting_only'
  | 'exclusivity_conflict'
  | 'exclusivity_nearby'
  | 'content_rule'
  | 'usage_rights'
  | 'deadline_passed'
  | 'tight_deadline'
  | 'suspicious_request'
  | 'unverified_third_party'
  | 'terms_changed'
  | 'missing_details'
  | 'unparsed_fee'
  | 'analysis_failed'

export interface Flag {
  code: FlagCode
  severity: Severity
  title: string
  /** Plain-language reason, with the numbers or the rule it was judged against. */
  reason: string
  /** Words from the email, when the flag rests on them. */
  evidence?: string
  /** Who established it. `model+code` means the model pointed at it and code verified the quote. */
  source: 'code' | 'model+code'
}

export interface Money {
  amount: number
  currency: 'INR' | 'USD'
  inr: number
  /** True when the email gave no currency and INR was assumed. */
  currencyAssumed: boolean
  text: string
}

export interface Terms {
  product: string | null
  deliverables: { type: DeliverableType; count: number }[]
  paymentType: Extraction['payment_type']
  fee: Money | null
  giftValue: Money | null
  deadline: { date: string | null; text: string | null } | null
  usage: { text: string | null; months: number | null; perpetual: boolean; paidAds: boolean; whitelisting: boolean } | null
  otherTerms: string[]
}

export interface Signal {
  type: RedFlagType
  quote: string
  /** `model` signals passed the quote check; `code` signals come from the deterministic backstops. */
  source: 'model' | 'code'
}

export interface EmailResult {
  id: string
  receivedAt: string
  from: string
  subject: string
  body: string
  /** `failed` means the model output never validated; only the code backstops ran. */
  status: 'ok' | 'failed'
  category: Category
  categoryReason: string
  modelCategory: Category | null
  dealId: string
  language: string | null
  summary: string | null
  extraction: Extraction | null
  signals: Signal[]
  /** Model claims thrown away because the quoted evidence is not in the email. */
  droppedClaims: string[]
}

export interface RateCheck {
  rateCardInr: number
  offeredInr: number
  /** Negative when the offer is below the rate card. */
  gapPct: number
  /** Deliverables the profile has no rate for, so they are not in rateCardInr. */
  unpriced: string[]
}

export interface Deal {
  id: string
  brand: string
  contact: { name: string | null; email: string; org: string | null }
  emailIds: string[]
  latestEmailId: string
  category: Category
  action: Action
  /** One sentence: why this action. */
  why: string
  /** 1 = look at this first. */
  rank: number
  terms: Terms
  /** How terms moved across the thread, oldest first. */
  history: { emailId: string; field: string; from: string; to: string }[]
  rate: RateCheck | null
  counter: { amount: number; currency: 'INR' | 'USD' } | null
  flags: Flag[]
  draft: { subject: string; body: string; language: string; source: 'model' | 'template' } | null
}

export interface RunStats {
  mode: 'replay' | 'live'
  provider: string
  model: string
  promptVersion: string
  calls: number
  failures: number
  retries: number
  promptTokens: number
  completionTokens: number
  /** Latency of the calls as recorded, even when replayed. */
  recordedLatencyMs: number
}

export interface Analysis {
  generatedFor: string
  today: string
  emails: EmailResult[]
  deals: Deal[]
  summaryMarkdown: string
  stats: RunStats
}
