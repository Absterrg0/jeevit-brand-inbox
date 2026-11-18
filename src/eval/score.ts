import type { Analysis, Category } from '../engine/types'
import { ALTERNATIVE_LABELS, EXPECTED_DEALS, EXPECTED_EMAILS, type ExpectedDeal } from './expected'

export interface FieldResult {
  key: string
  label: string
  pass: boolean
  expected: string
  got: string
}

export interface DealResult {
  brandKey: string
  brand: string
  pass: boolean
  fields: FieldResult[]
  debatable?: string
}

export interface FieldTotal {
  key: string
  label: string
  passed: number
  total: number
}

export interface EvalReport {
  emails: { id: string; expected: Category; got: Category; pass: boolean; note?: string }[]
  deals: DealResult[]
  byField: FieldTotal[]
  categoryCorrect: number
  categoryTotal: number
  alternativeCorrect: number
  exactDeals: number
  totalDeals: number
  checksPassed: number
  checksTotal: number
}

const show = (value: unknown) => (value === null || value === undefined ? '—' : String(value))

const normaliseDeliverables = (value: Record<string, number>) =>
  Object.entries(value)
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, qty]) => `${kind}:${qty}`)
    .join(',')

function compareDeal(deal: NonNullable<Analysis['deals'][number]>, expected: ExpectedDeal): DealResult {
  const fields: FieldResult[] = []
  const add = (key: string, label: string, pass: boolean, want: unknown, got: unknown) =>
    fields.push({ key, label, pass, expected: show(want), got: show(got) })

  add('brand', 'Brand', deal.brand === expected.brand, expected.brand, deal.brand)
  add('category', 'Category', deal.category === expected.category, expected.category, deal.category)
  add('fee', 'Fee (INR)', (deal.terms.fee?.inr ?? null) === expected.feeInr, expected.feeInr, deal.terms.fee?.inr ?? null)
  if (expected.currency) {
    add('currency', 'Currency', deal.terms.fee?.currency === expected.currency, expected.currency, deal.terms.fee?.currency ?? null)
  }
  add(
    'deliverables',
    'Deliverables',
    normaliseDeliverables(Object.fromEntries(deal.terms.deliverables.map((d) => [d.kind, d.qty]))) === normaliseDeliverables(expected.deliverables),
    normaliseDeliverables(expected.deliverables) || '—',
    normaliseDeliverables(Object.fromEntries(deal.terms.deliverables.map((d) => [d.kind, d.qty]))) || '—',
  )
  add('deadline', 'Deadline', deal.terms.deadline.date === expected.deadline, expected.deadline, deal.terms.deadline.date)
  add(
    'usage',
    'Usage',
    deal.terms.usage.months === expected.usageMonths && deal.terms.usage.perpetual === expected.perpetual,
    expected.perpetual ? 'perpetual' : expected.usageMonths ? `${expected.usageMonths} months` : 'none',
    deal.terms.usage.perpetual ? 'perpetual' : deal.terms.usage.months ? `${deal.terms.usage.months} months` : 'none',
  )
  add('group', 'Thread size', deal.emails.length === expected.groupSize, expected.groupSize, deal.emails.length)
  add('action', 'Next step', deal.action === expected.action, expected.action, deal.action)
  if (expected.keyRisks.length) {
    const codes = new Set<string>(deal.risks.map((r) => r.code))
    add('risks', 'Key risks', expected.keyRisks.every((code) => codes.has(code)), expected.keyRisks.join(', '), deal.risks.map((r) => r.code).join(', ') || '—')
  }

  return {
    brandKey: expected.brandKey,
    brand: expected.brand,
    pass: fields.every((f) => f.pass),
    fields,
    debatable: expected.debatable,
  }
}

export function evaluate(analysis: Analysis): EvalReport {
  const emails = EXPECTED_EMAILS.map((expected) => {
    const got = analysis.emails.find((e) => e.id === expected.id)?.category ?? 'spam'
    return { id: expected.id, expected: expected.category, got, pass: got === expected.category, note: expected.note }
  })

  const deals = EXPECTED_DEALS.map((expected) => {
    const deal = analysis.deals.find((d) => d.brandKey === expected.brandKey)
    if (!deal) {
      return {
        brandKey: expected.brandKey,
        brand: expected.brand,
        pass: false,
        fields: [{ key: 'deal', label: 'Deal found', pass: false, expected: expected.brand, got: '—' }],
        debatable: expected.debatable,
      }
    }
    return compareDeal(deal, expected)
  })

  const fieldKeys = [...new Set(deals.flatMap((d) => d.fields.map((f) => f.key)))]
  const byField: FieldTotal[] = fieldKeys.map((key) => {
    const all = deals.flatMap((d) => d.fields.filter((f) => f.key === key))
    return { key, label: all[0]?.label ?? key, passed: all.filter((f) => f.pass).length, total: all.length }
  })

  const allFields = deals.flatMap((d) => d.fields)
  const categoryCorrect = emails.filter((e) => e.pass).length
  const alternativeCorrect = EXPECTED_EMAILS.filter((expected) => {
    const alt = ALTERNATIVE_LABELS[expected.id] ?? expected.category
    return analysis.emails.find((e) => e.id === expected.id)?.category === alt
  }).length

  return {
    emails,
    deals,
    byField,
    categoryCorrect,
    categoryTotal: emails.length,
    alternativeCorrect,
    exactDeals: deals.filter((d) => d.pass).length,
    totalDeals: deals.length,
    checksPassed: allFields.filter((f) => f.pass).length,
    checksTotal: allFields.length,
  }
}

export function formatReport(report: EvalReport): string {
  const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`
  const lines = [
    '# Evaluation',
    '',
    `Categories: **${report.categoryCorrect}/${report.categoryTotal}** (${pct(report.categoryCorrect, report.categoryTotal)})`,
    `Deal records fully correct: **${report.exactDeals}/${report.totalDeals}**`,
    `Individual field checks: **${report.checksPassed}/${report.checksTotal}** (${pct(report.checksPassed, report.checksTotal)})`,
    `Under the alternative readings listed in expected.ts: **${report.alternativeCorrect}/${report.categoryTotal}**`,
    '',
    '## Per email',
    '',
    '| Email | Expected | Got | |',
    '| --- | --- | --- | --- |',
    ...report.emails.map((e) => `| ${e.id} | ${e.expected} | ${e.got} | ${e.pass ? 'pass' : '**miss**'} |`),
    '',
    '## Per deal',
    '',
    '| Deal | Fields | Result |',
    '| --- | --- | --- |',
    ...report.deals.map((d) => {
      const missed = d.fields.filter((f) => !f.pass)
      return `| ${d.brand} | ${d.fields.length - missed.length}/${d.fields.length} | ${d.pass ? 'exact' : `missed ${missed.map((f) => `${f.label} (${f.expected} vs ${f.got})`).join('; ')}`} |`
    }),
    '',
    '## By field',
    '',
    '| Field | Correct |',
    '| --- | --- |',
    ...report.byField.map((f) => `| ${f.label} | ${f.passed}/${f.total} |`),
    '',
    '_Labels were written by hand before the engine was finished, then used to tune it. This is a specification check on 15 emails, not a held-out benchmark._',
  ]
  return lines.join('\n')
}
