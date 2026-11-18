import {
  Archive,
  Check,
  CircleSlash,
  HandCoins,
  MessageCircleQuestion,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import type { Action, Category, Severity } from '../engine/types'

export const CATEGORY_META: Record<Category, { label: string; short: string; dot: string; hint: string }> = {
  deal_offer: {
    label: 'Deal offer',
    short: 'Offer',
    dot: 'bg-label-green',
    hint: 'A real paid or barter offer with enough terms to judge.',
  },
  needs_more_info: {
    label: 'Needs more info',
    short: 'Needs info',
    dot: 'bg-label-blue',
    hint: 'Possibly real, but missing the terms that decide whether it is fair.',
  },
  not_a_fit: {
    label: 'Not a fit',
    short: 'Not a fit',
    dot: 'bg-label-violet',
    hint: 'Real, but it breaks a rule or an exclusivity.',
  },
  scam_or_phishing: {
    label: 'Scam or phishing',
    short: 'Scam',
    dot: 'bg-label-red',
    hint: 'Trying to extract money, data or a click. Do not reply.',
  },
  spam: {
    label: 'Spam',
    short: 'Spam',
    dot: 'bg-subtle-foreground',
    hint: 'Bulk mail with no ask and no offer.',
  },
}

export const ACTION_META: Record<Action, { label: string; icon: LucideIcon; short: string }> = {
  negotiate: { label: 'Negotiate', short: 'Counter', icon: HandCoins },
  ask_for_details: { label: 'Ask for details', short: 'Ask', icon: MessageCircleQuestion },
  accept: { label: 'Accept', short: 'Accept', icon: Check },
  decline: { label: 'Decline', short: 'Decline', icon: CircleSlash },
  report: { label: 'Report', short: 'Report', icon: ShieldAlert },
  ignore: { label: 'Ignore', short: 'Ignore', icon: Archive },
}

export const SEVERITY_META: Record<Severity, { label: string; dot: string; text: string; soft: string }> = {
  high: { label: 'High', dot: 'bg-label-red', text: 'text-destructive', soft: 'bg-[#fdf0ee]' },
  medium: { label: 'Medium', dot: 'bg-quiet', text: 'text-quiet-ink', soft: 'bg-quiet-soft' },
  low: { label: 'Low', dot: 'bg-subtle-foreground', text: 'text-muted-foreground', soft: 'bg-muted' },
}

/** Board lanes use the recommendation as the column: what the creator should do next. */
export const ACTION_ORDER: Action[] = ['negotiate', 'ask_for_details', 'accept', 'decline', 'report']

export const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export const riskTone = (score: number): Severity | 'none' => (score >= 60 ? 'high' : score >= 30 ? 'medium' : score > 0 ? 'low' : 'none')
