/**
 * Which language to reply in. Decided by code: the model's own language label was wrong on
 * 2 of the 15 supplied emails (it called two English emails Hindi and Hinglish), and a reply
 * in the wrong language is the kind of mistake a creator would not forgive.
 */
import type { Profile } from '../types'

// Common Hindi function words in Latin script. Three or more distinct hits means Hinglish.
const HINGLISH = new Set(['hai', 'hain', 'hum', 'aap', 'aapke', 'aapka', 'aapki', 'kya', 'nahi', 'nahin', 'ke', 'ka', 'ki', 'ko', 'se', 'mein', 'saath', 'chahte', 'karna', 'karenge', 'hoga', 'liye', 'bahut', 'dhanyavaad', 'namaste', 'ji', 'ek', 'aur', 'yeh', 'humara', 'hamara'])

export type Language = 'English' | 'Hindi' | 'Hinglish'

export function detectLanguage(text: string): Language {
  const letters = text.match(/\p{L}/gu) ?? []
  const devanagari = letters.filter((c) => /\p{Script=Devanagari}/u.test(c)).length
  if (letters.length && devanagari / letters.length > 0.3) return 'Hindi'
  const hits = new Set((text.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => HINGLISH.has(w)))
  return hits.size >= 3 ? 'Hinglish' : 'English'
}

/** Reply in the email's language if the creator lists it, otherwise in English. */
export function replyLanguage(text: string, profile: Profile): Language {
  return profile.languages.some((l) => /hindi/i.test(l)) ? detectLanguage(text) : 'English'
}
