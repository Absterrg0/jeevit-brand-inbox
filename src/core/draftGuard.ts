/**
 * Checks on a model-written reply before the creator ever sees it, and the
 * plain template used when a draft fails them.
 *
 * The drafting model is given the points to make (written by policy.ts) and
 * never the raw email, so there is little for an attacker to steer. These
 * checks cover the rest: a draft may not introduce a figure, a link, an email
 * address or a phone number that the policy did not put there.
 */

const digits = (s: string) => s.replace(/[,\s]/g, '')

/** Every number of three or more digits in the text, without separators. */
function bigNumbers(text: string): string[] {
  return (text.match(/\d[\d,]*\d/g) ?? []).map(digits).filter((n) => n.length >= 3)
}

/** Returns the reasons a draft is rejected; an empty list means it may be shown. */
export function draftProblems(body: string, points: string[]): string[] {
  const problems: string[] = []
  const allowed = new Set(bigNumbers(points.join(' ')))
  for (const n of bigNumbers(body)) if (!allowed.has(n)) problems.push(`contains a number that is not in the notes: ${n}`)
  if (/https?:\/\/|www\./i.test(body)) problems.push('contains a link')
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(body)) problems.push('contains an email address')
  if (/(\+?\d[\s-]?){10,}/.test(body)) problems.push('contains something that looks like a phone number')
  if (/\[[^\]]{2,40}\]/.test(body)) problems.push('contains a placeholder in square brackets')
  if (body.split(/\s+/).length > 190) problems.push('is longer than 190 words')
  return problems
}

/** Deterministic fallback: the policy's own sentences, in English. */
export function templateDraft(input: { greetingName: string | null; points: string[]; signature: string }): string {
  return [`Hi ${input.greetingName ?? 'there'},`, '', ...input.points.flatMap((p) => [p, '']), 'Best,', input.signature].join('\n')
}

/** Brand and contact names come from the model's reading of an untrusted email. Keep them short and plain. */
export function safeName(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value
    .replace(/[^\p{L}\p{N} .&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return cleaned || null
}
