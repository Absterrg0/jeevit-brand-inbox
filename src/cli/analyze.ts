/**
 * npm run analyze                 replay the recorded model responses (no key, no network)
 * npm run analyze -- --live       call the configured model for anything not recorded, and record it
 * npm run analyze -- --fresh      call the model for everything, record nothing
 *
 * Options: --inbox <file> --profile <file> --recordings <file> --out <dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyseInbox } from '../pipeline'
import { flag, loadEnv, loadInputs, openLlm, option } from './shared'

async function main() {
  loadEnv()
  const { emails, profile } = loadInputs(option('inbox', 'data/inbox.json'), option('profile', 'data/creator_profile.json'))
  const llm = openLlm(option('recordings', 'recordings/inbox.json'))
  const outDir = option('out', 'out')
  const quiet = flag('quiet')

  const analysis = await analyseInbox(emails, profile, llm, { onProgress: llm.mode === 'replay' || quiet ? undefined : (m) => console.error(`  ${m}`) })

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`)
  writeFileSync(join(outDir, 'summary.md'), `${analysis.summaryMarkdown}\n`)

  console.log(analysis.summaryMarkdown)
  console.log('\nDeals')
  for (const d of analysis.deals) {
    const fee = d.terms.fee ? `${d.terms.fee.currency} ${d.terms.fee.amount.toLocaleString('en-IN')}` : d.terms.giftValue ? 'gifting' : '-'
    console.log(`  ${d.id}  ${d.brand.slice(0, 20).padEnd(20)} ${d.category.padEnd(17)} ${fee.padEnd(13)} ${d.action.padEnd(16)} ${d.emailIds.join(',')}`)
  }
  const s = analysis.stats
  console.log(`\n${s.mode} · ${s.provider} · ${s.model} · ${s.calls} model calls (${s.retries} retries, ${s.failures} failed) · ${s.promptTokens} prompt + ${s.completionTokens} completion tokens`)
  if (s.failures) console.log(`${s.failures} email(s) could not be analysed; they are listed first in the summary.`)
  console.log(`Wrote ${join(outDir, 'analysis.json')} and ${join(outDir, 'summary.md')}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
