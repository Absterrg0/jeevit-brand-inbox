/**
 * Two guards on what the model says about an email.
 *
 * 1. Quote check. Any claim that can change the category (a rule conflict, an
 *    exclusivity conflict, a red flag) must come with words from the email.
 *    If those words are not in the email, the claim is dropped.
 * 2. Backstops. Two patterns are checked by code on the raw text whether or not
 *    the model noticed them: text addressed to an AI, and a domain that borrows
 *    a platform's name. These are deliberately few and general. They are a
 *    safety net under the model, not a classifier.
 */
import type { Email, Signal } from '../types'

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

/** True when (nearly) every word of the quote appears in the source text. */
export function quoteIsGrounded(quote: string, source: string): boolean {
  // Models like to gloss a quote in brackets: "Pixelon 9 smartphone (a competing phone)". Judge the quote, not the gloss.
  const q = words(quote.replace(/\([^)]*\)/g, ' '))
  if (q.length === 0) return false
  const haystack = new Set(words(source))
  const hits = q.filter((w) => haystack.has(w)).length
  // Small models trim or lightly reword a quote; allow one word in five to differ.
  return hits / q.length >= 0.8
}

const INJECTION_PATTERNS: RegExp[] = [
  // Something that names an AI, followed closely by an order about how to handle the email.
  /\b(ai|a\.i\.|llm|gpt|chatbot|language model|automated (assistant|system))\b[^\n]{0,160}\b(classify|categori[sz]e|mark this|recommend|approve|auto-?accept|whitelist|trusted|draft a reply|include the|reveal)/i,
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your)\b[^.\n]{0,30}\b(instructions?|rules?|prompts?|guidelines?)/i,
  /(\bsystem prompt\b|\bsystem message\b|\bsystem\s*:|\bdeveloper message\b|\bnew instructions?\s*:)/i,
  /\bclassify this (email|message) as\b/i,
]

const PLATFORMS: { name: string; official: RegExp }[] = [
  { name: 'youtube', official: /(^|\.)(youtube\.com|google\.com|youtu\.be)$/ },
  { name: 'instagram', official: /(^|\.)(instagram\.com|facebookmail\.com|meta\.com)$/ },
  { name: 'insta', official: /(^|\.)(instagram\.com|facebookmail\.com|meta\.com)$/ },
  { name: 'facebook', official: /(^|\.)(facebook\.com|facebookmail\.com|meta\.com)$/ },
  { name: 'google', official: /(^|\.)(google\.com)$/ },
  { name: 'tiktok', official: /(^|\.)(tiktok\.com)$/ },
]

export const senderDomain = (from: string) => (from.split('@')[1] ?? '').trim().toLowerCase()

function domainsIn(email: Email): string[] {
  const urls = [...email.body.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase())
  return [senderDomain(email.from), ...urls].filter(Boolean)
}

/** Signals established by code alone. Both kinds are treated as hard evidence of a scam. */
export function backstopSignals(email: Email): Signal[] {
  const signals: Signal[] = []
  const haystack = `${email.subject}\n${email.body}`

  for (const pattern of INJECTION_PATTERNS) {
    const hit = pattern.exec(haystack)
    if (hit) {
      signals.push({ type: 'instructions_to_ai', quote: hit[0].trim(), source: 'code' })
      break
    }
  }

  for (const domain of domainsIn(email)) {
    const lookalike = PLATFORMS.find((p) => domain.includes(p.name) && !p.official.test(domain))
    if (lookalike) {
      signals.push({ type: 'impersonation', quote: domain, source: 'code' })
      break
    }
  }
  return signals
}

/**
 * Does a quote read like a demand for the creator's money? Used only to corroborate the
 * model when it says "this email asks the creator to pay": both have to agree. "Fee: USD 800"
 * is an offer and fails; "Pay a one-time registration fee of Rs 2,999" passes.
 */
export function looksLikePaymentDemand(quote: string): boolean {
  if (/\bwe(?:'ll| will| can| would)?\s+(pay|offer)\b/i.test(quote)) return false
  return /\b(pay|paying|deposit|purchase|buy|registration|register|joining|membership|subscription|activation|processing|security|unlock|upgrade)\b/i.test(quote)
}
