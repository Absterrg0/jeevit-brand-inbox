/**
 * Scoring against the hand labels. Pure functions over an Analysis and a label
 * file, so the same code scores the main inbox, the held-out set and each
 * variance run.
 */
import { brandKey } from '../core/brand'
import { CATEGORIES, type Analysis, type Category, type Deal } from '../types'

export interface Labels {
  about: string
  emails: Record<string, { category: Category; note?: string }>
  deals: {
    emails: string[]
    brand: string[]
    action: string
    fields: Record<string, unknown>
    must_flag: string[]
    may_flag?: string[]
    note?: string
  }[]
}

export interface Miss {
  where: string
  what: string
  expected: string
  got: string
  detail?: string
}

export interface Score {
  emails: number
  category: { correct: number; total: number; modelAloneCorrect: number }
  perCategory: Record<Category, { expected: number; predicted: number; correct: number }>
  /** confusion[expected][predicted] */
  confusion: Record<Category, Record<Category, number>>
  grouping: { correct: number; total: number }
  action: { correct: number; total: number }
  fields: Record<string, { correct: number; total: number }>
  fieldsTotal: { correct: number; total: number }
  mustFlags: { found: number; total: number }
  /** High-severity flags the labels neither require nor allow. */
  falseAlarms: string[]
  misses: Miss[]
  unanalysed: string[]
}

const show = (v: unknown) => (v === null || v === undefined ? 'none' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** The pipeline's value for each labelled field name. */
function actual(deal: Deal, field: string): unknown {
  const t = deal.terms
  switch (field) {
    case 'fee_inr':
      return t.fee?.inr ?? null
    case 'currency':
      return t.fee?.currency ?? null
    case 'payment_type':
      return t.paymentType === 'not_stated' ? null : t.paymentType
    case 'gift_value_inr':
      return t.giftValue?.inr ?? null
    case 'deliverables':
      return Object.fromEntries(t.deliverables.map((d) => [d.type, d.count]).sort())
    case 'deadline':
      return t.deadline?.date ?? null
    case 'usage_months':
      return t.usage?.months ?? null
    case 'usage_perpetual':
      return t.usage?.perpetual ?? false
    default:
      throw new Error(`Unknown label field "${field}"`)
  }
}

const same = (a: unknown, b: unknown) => {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
  }
  return a === b
}

export function score(analysis: Analysis, labels: Labels): Score {
  const zero = () => Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  const s: Score = {
    emails: analysis.emails.length,
    category: { correct: 0, total: 0, modelAloneCorrect: 0 },
    perCategory: Object.fromEntries(CATEGORIES.map((c) => [c, { expected: 0, predicted: 0, correct: 0 }])) as Score['perCategory'],
    confusion: Object.fromEntries(CATEGORIES.map((c) => [c, zero()])) as Score['confusion'],
    grouping: { correct: 0, total: 0 },
    action: { correct: 0, total: 0 },
    fields: {},
    fieldsTotal: { correct: 0, total: 0 },
    mustFlags: { found: 0, total: 0 },
    falseAlarms: [],
    misses: [],
    unanalysed: analysis.emails.filter((e) => e.status === 'failed').map((e) => e.id),
  }

  for (const email of analysis.emails) {
    const expected = labels.emails[email.id]?.category
    if (!expected) continue
    s.category.total += 1
    s.perCategory[expected].expected += 1
    s.perCategory[email.category].predicted += 1
    s.confusion[expected][email.category] += 1
    if (email.modelCategory === expected) s.category.modelAloneCorrect += 1
    if (email.category === expected) {
      s.category.correct += 1
      s.perCategory[expected].correct += 1
    } else {
      s.misses.push({ where: email.id, what: 'category', expected, got: email.category, detail: email.categoryReason })
    }
  }

  for (const label of labels.deals) {
    const name = `${label.brand[0]} (${label.emails.join(', ')})`
    // The deal is found by its latest email, which is the one whose terms should win.
    const deal = analysis.deals.find((d) => d.emailIds.includes(label.emails[label.emails.length - 1]))
    if (!deal) continue

    s.grouping.total += 1
    if (same([...deal.emailIds].sort(), [...label.emails].sort())) s.grouping.correct += 1
    else s.misses.push({ where: name, what: 'grouping', expected: label.emails.join(' + '), got: deal.emailIds.join(' + ') })

    s.action.total += 1
    if (deal.action === label.action) s.action.correct += 1
    else s.misses.push({ where: name, what: 'action', expected: label.action, got: deal.action, detail: deal.why })

    const fields: Record<string, unknown> = { brand: label.brand, ...label.fields }
    for (const [field, expected] of Object.entries(fields)) {
      const got = field === 'brand' ? deal.brand : actual(deal, field)
      const ok = field === 'brand' ? label.brand.some((b) => brandKey(b) === brandKey(deal.brand)) : same(expected, got)
      s.fields[field] ??= { correct: 0, total: 0 }
      s.fields[field].total += 1
      s.fieldsTotal.total += 1
      if (ok) {
        s.fields[field].correct += 1
        s.fieldsTotal.correct += 1
      } else {
        s.misses.push({ where: name, what: field, expected: field === 'brand' ? label.brand[0] : show(expected), got: show(got) })
      }
    }

    const codes = new Set(deal.flags.map((f) => f.code))
    for (const must of label.must_flag) {
      s.mustFlags.total += 1
      if (codes.has(must as never)) s.mustFlags.found += 1
      else s.misses.push({ where: name, what: 'risk flag', expected: must, got: [...codes].join(', ') || 'no flags' })
    }
    const allowed = new Set([...label.must_flag, ...(label.may_flag ?? [])])
    for (const f of deal.flags) {
      if (f.severity === 'high' && !allowed.has(f.code)) s.falseAlarms.push(`${name}: ${f.code} ("${f.title}")`)
    }
  }
  return s
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a')
const frac = (x: { correct: number; total: number }) => `${x.correct}/${x.total} (${pct(x.correct, x.total)})`

export function renderScore(title: string, s: Score, labels: Labels): string {
  const out: string[] = [`## ${title}`, '']
  out.push('| Measure | Result |', '| --- | --- |')
  out.push(`| Email category | **${frac(s.category)}** |`)
  out.push(`| Email category, model's own guess with no code | ${s.category.modelAloneCorrect}/${s.category.total} (${pct(s.category.modelAloneCorrect, s.category.total)}) |`)
  out.push(`| Emails grouped into the right deal | ${frac(s.grouping)} |`)
  out.push(`| Deal fields (all, below) | **${frac(s.fieldsTotal)}** |`)
  out.push(`| Recommended action | **${frac(s.action)}** |`)
  out.push(`| Required risk flags raised | ${s.mustFlags.found}/${s.mustFlags.total} (${pct(s.mustFlags.found, s.mustFlags.total)}) |`)
  out.push(`| High-severity flags that should not be there | ${s.falseAlarms.length} |`)
  out.push(`| Emails the model failed to return valid output for | ${s.unanalysed.length} |`)

  out.push('', '**Per category**', '', '| Category | Labelled | Predicted | Correct | Precision | Recall |', '| --- | --- | --- | --- | --- | --- |')
  for (const c of CATEGORIES) {
    const p = s.perCategory[c]
    out.push(`| ${c} | ${p.expected} | ${p.predicted} | ${p.correct} | ${pct(p.correct, p.predicted)} | ${pct(p.correct, p.expected)} |`)
  }

  out.push('', '**Confusion** (rows: labelled, columns: predicted)', '', `| | ${CATEGORIES.join(' | ')} |`, `| --- | ${CATEGORIES.map(() => '---').join(' | ')} |`)
  for (const row of CATEGORIES) out.push(`| **${row}** | ${CATEGORIES.map((col) => s.confusion[row][col] || '·').join(' | ')} |`)

  out.push('', '**Per field**', '', '| Field | Correct |', '| --- | --- |')
  for (const [field, v] of Object.entries(s.fields)) out.push(`| ${field} | ${frac(v)} |`)

  out.push('', `**Misses (${s.misses.length})**`, '')
  if (!s.misses.length) out.push('None.')
  for (const m of s.misses) {
    const note = labels.emails[m.where]?.note
    out.push(`- **${m.where}**, ${m.what}: expected \`${m.expected}\`, got \`${m.got}\`.${m.detail ? ` Pipeline said: ${m.detail}` : ''}${note ? ` Label note: ${note}` : ''}`)
  }
  if (s.falseAlarms.length) {
    out.push('', '**Unexpected high-severity flags**', '')
    for (const f of s.falseAlarms) out.push(`- ${f}`)
  }
  return out.join('\n')
}
