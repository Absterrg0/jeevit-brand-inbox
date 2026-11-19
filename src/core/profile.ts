/**
 * The creator's rules, as numbers code can compare against.
 *
 * Two values live in free-text profile fields ("Use 1 USD = 84 INR", "Up to 3
 * months of paid-ad usage is included"). They are read once here with a regex
 * and an explicit fallback. In a product these would be structured fields the
 * creator confirms at onboarding; see DECISIONS.md.
 */
import type { Profile } from '../types'

export interface Policy {
  usdToInr: number
  includedUsageMonths: number
  /** Below this many days from today to go-live, the deadline is flagged as tight. */
  tightDeadlineDays: number
  /** Where a regex could not read the profile and a default was used. */
  warnings: string[]
}

export function derivePolicy(profile: Profile): Policy {
  const warnings: string[] = []

  const fx = /1\s*USD\s*=\s*(\d+(?:\.\d+)?)\s*INR/i.exec(profile.currency_note)
  if (!fx) warnings.push('Could not read a USD rate from currency_note; using 84.')

  const usage = /(\d+)\s*months?/i.exec(profile.usage_rights_policy)
  if (!usage) warnings.push('Could not read included usage months from usage_rights_policy; using 3.')

  return {
    usdToInr: fx ? Number(fx[1]) : 84,
    includedUsageMonths: usage ? Number(usage[1]) : 3,
    tightDeadlineDays: 3,
    warnings,
  }
}

export const firstName = (profile: Profile) => profile.name.split(/\s+/)[0]
