/**
 * Calendar logic. The model reads "before 10 December" and returns day=10,
 * month=12; code decides the year and does every comparison.
 */

const DAY = 86_400_000

export function toIso(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day))
  // Rejects 31 November and friends instead of rolling them into the next month.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return d.toISOString().slice(0, 10)
}

/**
 * Resolve a day/month (and maybe year) against the date the email arrived.
 *
 * With no year written, assume the year the email was received. Only roll into
 * next year when the date would otherwise be more than six months in the past
 * (a December email asking for "15 January"). A date that is a few days or
 * weeks behind stays in the past on purpose: "go live by 1 November" in an
 * email sent on 10 November is a broken brief, not a plan for next year.
 */
export function resolveDate(
  parts: { day: number | null; month: number | null; year: number | null },
  receivedAt: string,
): string | null {
  if (!parts.day || !parts.month) return null
  const received = receivedAt.slice(0, 10)
  const receivedYear = Number(received.slice(0, 4))
  if (parts.year) return toIso(parts.year, parts.month, parts.day)
  const sameYear = toIso(receivedYear, parts.month, parts.day)
  if (!sameYear) return null
  return daysBetween(sameYear, received) > 183 ? toIso(receivedYear + 1, parts.month, parts.day) : sameYear
}

/** Whole days from `from` to `to` (positive when `to` is later). Accepts ISO dates or "YYYY-MM-DD HH:mm". */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY)
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
