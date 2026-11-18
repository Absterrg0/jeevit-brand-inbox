/**
 * CLI entry point.
 *
 *   npm run analyze            deterministic engine, writes out/analysis.json
 *                              and out/summary.md
 *   npm run analyze -- --ai    also asks an LLM to review the ambiguous emails
 *                              (needs OPENROUTER_API_KEY; never required)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeInbox } from '../src/engine/analyze'
import { sourceAnalysis } from '../src/engine/ai'
import { INBOX, PROFILE } from '../src/engine/dataset'
import { formatInr } from '../src/engine/text'

async function main() {
  const useAi = process.argv.includes('--ai')
  let analysis = analyzeInbox(INBOX, PROFILE)

  if (useAi) {
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('--ai needs OPENROUTER_API_KEY. Running the deterministic engine instead.\n')
    } else {
      const { analysis: merged, changed } = await sourceAnalysis(analysis, INBOX, PROFILE)
      analysis = merged
      console.log(`AI review: ${changed} email${changed === 1 ? '' : 's'} changed. Guardrails kept every deterministic block.\n`)
    }
  }

  const out = join(process.cwd(), 'out')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`)
  writeFileSync(join(out, 'summary.md'), `${analysis.summary.markdown}\n`)

  console.log(analysis.summary.markdown)
  console.log('\n── Deals ──────────────────────────────────────────────')
  for (const d of [...analysis.deals].sort((a, b) => b.priority - a.priority)) {
    const fee = d.terms.fee ? `${d.terms.fee.currency} ${d.terms.fee.amount.toLocaleString('en-IN')}` : '—'
    console.log(
      `${d.id}  ${d.brand.padEnd(22)} ${d.category.padEnd(17)} ${fee.padEnd(12)} ${d.action.padEnd(16)} ${d.risks.length} risk${d.risks.length === 1 ? '' : 's'}`,
    )
  }
  console.log(`\nOffers on the table: ${formatInr(analysis.summary.money.offeredInr)}`)
  console.log(`Wrote out/analysis.json and out/summary.md`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
