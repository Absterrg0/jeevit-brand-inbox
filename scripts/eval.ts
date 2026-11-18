/**
 * Runs the hand labels against the shipped engine and writes eval/report.md.
 * The UI's Evaluation page scores the same data in the browser, so the README,
 * the CLI and the app cannot drift apart.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ANALYSIS } from '../src/engine/dataset'
import { evaluate, formatReport } from '../src/eval/score'

const report = evaluate(ANALYSIS)
const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`

const summary = [
  `Categories: ${report.categoryCorrect}/${report.categoryTotal} (${pct(report.categoryCorrect, report.categoryTotal)})`,
  `Exact deals: ${report.exactDeals}/${report.totalDeals}`,
  `Field checks: ${report.checksPassed}/${report.checksTotal} (${pct(report.checksPassed, report.checksTotal)})`,
  `Alternative labels: ${report.alternativeCorrect}/${report.categoryTotal}`,
].join(' · ')

mkdirSync(join(process.cwd(), 'eval'), { recursive: true })
writeFileSync(join(process.cwd(), 'eval', 'report.md'), `${formatReport(report)}\n`)
writeFileSync(join(process.cwd(), 'eval', 'results.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(formatReport(report))
console.log(`\n${summary}`)
console.log('Wrote eval/report.md and eval/results.json')
