/**
 * npm run eval                      score the recorded run against the hand labels (no key needed)
 * npm run eval -- --live            same, calling the model for anything not recorded
 * npm run eval -- --variance 3      re-run extraction on the main inbox N times, live, at
 *                                   --temperature (default 0.7), and report how often answers change
 *
 * Writes eval/report.md and eval/results.json (and eval/variance.json for --variance).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { providerFromEnv } from '../llm/provider'
import { RecordedLlm } from '../llm/recordings'
import { analyseInbox } from '../pipeline'
import { renderScore, score, type Labels } from '../eval/score'
import { flag, loadEnv, loadInputs, openLlm, option } from './shared'

const SETS = [
  { name: 'Main inbox (the 15 supplied emails)', key: 'main', inbox: 'data/inbox.json', labels: 'eval/labels.inbox.json', recordings: 'recordings/inbox.json' },
  { name: 'Held-out set (15 emails written for this eval)', key: 'heldout', inbox: 'eval/heldout/inbox.json', labels: 'eval/heldout/labels.json', recordings: 'recordings/heldout.json' },
]
const PROFILE = 'data/creator_profile.json'

async function variance(runs: number) {
  const temperature = Number(option('temperature', '0.7'))
  const set = SETS[0]
  const { emails, profile } = loadInputs(set.inbox, PROFILE)
  const labels: Labels = JSON.parse(readFileSync(set.labels, 'utf8'))
  const results = []
  for (let i = 0; i < runs; i++) {
    console.error(`variance run ${i + 1}/${runs} at temperature ${temperature}`)
    const llm = new RecordedLlm(null, 'fresh', providerFromEnv())
    const analysis = await analyseInbox(emails, profile, llm, { skipDrafts: true, temperature, onProgress: (m) => console.error(`  ${m}`) })
    const s = score(analysis, labels)
    results.push({
      run: i + 1,
      category: s.category,
      fields: s.fieldsTotal,
      action: s.action,
      unanalysed: s.unanalysed,
      retries: analysis.stats.retries,
      categories: Object.fromEntries(analysis.emails.map((e) => [e.id, e.category])),
      actions: Object.fromEntries(analysis.deals.map((d) => [d.latestEmailId, d.action])),
      misses: s.misses.map((m) => `${m.where} ${m.what}: ${m.expected} → ${m.got}`),
    })
    writeFileSync('eval/variance.json', `${JSON.stringify({ temperature, model: analysis.stats.model, provider: analysis.stats.provider, runs: results }, null, 2)}\n`)
  }
  console.log(`Wrote eval/variance.json (${runs} runs).`)
}

function renderVariance(): string {
  if (!existsSync('eval/variance.json')) return ''
  const v = JSON.parse(readFileSync('eval/variance.json', 'utf8')) as {
    temperature: number
    model: string
    runs: { run: number; category: { correct: number; total: number }; fields: { correct: number; total: number }; action: { correct: number; total: number }; categories: Record<string, string>; unanalysed: string[] }[]
  }
  const ids = Object.keys(v.runs[0].categories)
  const unstable = ids.filter((id) => new Set(v.runs.map((r) => r.categories[id])).size > 1)
  const out = ['## Run-to-run variance', '']
  out.push(`${v.runs.length} extra live runs of the main inbox with \`${v.model}\` at temperature ${v.temperature} (the recorded run uses temperature 0). Drafts are skipped; only extraction and everything derived from it is scored.`, '')
  out.push('| Run | Category | Fields | Action | Not analysed |', '| --- | --- | --- | --- | --- |')
  for (const r of v.runs) out.push(`| ${r.run} | ${r.category.correct}/${r.category.total} | ${r.fields.correct}/${r.fields.total} | ${r.action.correct}/${r.action.total} | ${r.unanalysed.join(', ') || '0'} |`)
  out.push('', unstable.length ? `Emails whose category changed between runs: ${unstable.map((id) => `${id} (${[...new Set(v.runs.map((r) => r.categories[id]))].join(' / ')})`).join('; ')}.` : 'No email changed category between runs.')
  return out.join('\n')
}

async function main() {
  loadEnv()
  const runs = Number(option('variance', '0'))
  if (runs > 0) return variance(runs)

  const sections: string[] = []
  const results: Record<string, unknown> = {}
  let header = ''
  for (const set of SETS) {
    const { emails, profile } = loadInputs(set.inbox, PROFILE)
    const labels: Labels = JSON.parse(readFileSync(set.labels, 'utf8'))
    const llm = openLlm(set.recordings)
    const analysis = await analyseInbox(emails, profile, llm, { onProgress: flag('live') ? (m) => console.error(`  ${m}`) : undefined })
    const s = score(analysis, labels)
    results[set.key] = { stats: analysis.stats, score: s }
    sections.push(renderScore(set.name, s, labels))
    header ||= `Model: \`${analysis.stats.model}\` via ${analysis.stats.provider}, prompts \`${analysis.stats.promptVersion}\`.`
    console.log(`${set.name}\n  category ${s.category.correct}/${s.category.total} (model alone ${s.category.modelAloneCorrect}/${s.category.total}) · grouping ${s.grouping.correct}/${s.grouping.total} · fields ${s.fieldsTotal.correct}/${s.fieldsTotal.total} · action ${s.action.correct}/${s.action.total} · required flags ${s.mustFlags.found}/${s.mustFlags.total} · false alarms ${s.falseAlarms.length}`)
    for (const m of s.misses) console.log(`    miss  ${m.where}  ${m.what}: expected ${m.expected}, got ${m.got}`)
  }

  const report = [
    '# Evaluation report',
    '',
    'Generated by `npm run eval`. Do not edit by hand; the commentary on these numbers is in the README.',
    '',
    header,
    '',
    ...sections.flatMap((s) => [s, '']),
    renderVariance(),
  ].join('\n')
  writeFileSync('eval/report.md', `${report.trimEnd()}\n`)
  writeFileSync('eval/results.json', `${JSON.stringify(results, null, 2)}\n`)
  console.log('\nWrote eval/report.md and eval/results.json')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
