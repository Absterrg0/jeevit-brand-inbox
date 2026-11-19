/** Brand keys for grouping. "Dew Lab", "DewLab India" and dewlab.in all become "dewlab". */
import { senderDomain } from './evidence'

const FREE_MAIL = new Set(['gmail.com', 'yahoo.com', 'yahoo.in', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'icloud.com', 'proton.me', 'protonmail.com'])
const SUFFIXES = /\b(pvt|private|ltd|limited|inc|llc|co|company|india|official|brand|team|the|and)\b/g

export function brandKey(name: string | null | undefined): string | null {
  if (!name) return null
  const key = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(SUFFIXES, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
  return key.length >= 2 ? key : null
}

export const isFreeMail = (from: string) => FREE_MAIL.has(senderDomain(from))

/** "partnerships@dewlab.in" → "dewlab". Null for free-mail senders, where the domain says nothing. */
export function domainKey(from: string): string | null {
  const domain = senderDomain(from)
  if (!domain || FREE_MAIL.has(domain)) return null
  const labels = domain.split('.')
  // Second-level label, allowing for "brand.co.in".
  const root = labels.length >= 3 && labels[labels.length - 2].length <= 3 ? labels[labels.length - 3] : labels[labels.length - 2]
  return root ? root.replace(/[^a-z0-9]/g, '') : null
}

/** "Re: Fwd: Collab: Dew Lab x Riya" → "collab: dew lab x riya" */
export const threadSubject = (subject: string) =>
  subject
    .replace(/^(\s*(re|fwd?|fw)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase()

export function displayBrand(name: string | null, from: string): string {
  if (name) return name
  const key = domainKey(from)
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : from
}
