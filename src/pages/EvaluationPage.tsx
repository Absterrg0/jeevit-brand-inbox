import { AlertTriangle, Check, CircleHelp, FlaskConical, Minus } from 'lucide-react'
import type { Analysis } from '../engine/types'
import { evaluate } from '../eval/score'
import { ALTERNATIVE_LABELS } from '../eval/expected'
import { cx } from '../lib/cx'
import { PageHeader, PageSurface, SectionHeading } from '../components/Page'
import { CategoryChip, Meter } from '../components/ui/primitives'

export function EvaluationPage({ analysis }: { analysis: Analysis }) {
  const report = evaluate(analysis)
  const altRows = report.emails.filter((email) => ALTERNATIVE_LABELS[email.id] && ALTERNATIVE_LABELS[email.id] !== email.expected)

  return (
    <PageSurface>
      <PageHeader title="Evaluation" count="A specification check, run in the build" />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8" data-scrollbar>
        <div className="mx-auto max-w-[1020px] space-y-5 pt-1">
          <section className="grid gap-px overflow-hidden rounded-[14px] bg-card shadow-raised sm:grid-cols-2 lg:grid-cols-4">
            <Score label="Email categories" value={`${report.categoryCorrect}/${report.categoryTotal}`} note="Every email labelled as expected" pass={report.categoryCorrect === report.categoryTotal} />
            <Score label="Deal records" value={`${report.exactDeals}/${report.totalDeals}`} note="Every checked field on every deal" pass={report.exactDeals === report.totalDeals} />
            <Score label="Field checks" value={`${report.checksPassed}/${report.checksTotal}`} note="Fee, terms, thread size, action, risks" pass={report.checksPassed === report.checksTotal} />
            <Score label="Alternative readings" value={`${report.alternativeCorrect}/${report.categoryTotal}`} note="Under a second defensible label" pass={false} neutral />
          </section>

          <section className="flex gap-2.5 rounded-[13px] bg-quiet-soft p-3.5 text-quiet-ink shadow-[inset_0_1px_2px_rgb(168_90_6/0.08),inset_0_0_0_1px_rgb(217_138_28/0.2)]">
            <AlertTriangle aria-hidden className="mt-px size-4 shrink-0" />
            <div className="min-w-0 text-[12px] leading-[18px]">
              <p className="font-medium">Read this as a spec check, not a benchmark.</p>
              <p className="mt-0.5 opacity-90">
                I wrote these expected answers by hand from the 15 emails, then used them to tune the rules. They are not a held-out set, and
                the same person wrote both sides. The honest claim is that the engine matches this specification, not that it will match a
                new inbox. A second, stricter reading of three emails is listed below; the engine is checked against that too.
              </p>
            </div>
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section>
              <SectionHeading title="Every email" aside={`${report.categoryCorrect} exact`} />
              <div className="overflow-hidden rounded-[13px] bg-card shadow-raised">
                <table className="w-full table-fixed text-[12px]">
                  <thead>
                    <tr className="border-b border-border-muted text-left text-[11px] text-muted-foreground">
                      <th className="w-14 px-3 py-2 font-medium">Email</th>
                      <th className="px-2 py-2 font-medium">Read as</th>
                      <th className="w-16 px-2 py-2 text-right font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.emails.map((email, i) => (
                      <tr key={email.id} className={cx(i > 0 && 'border-t border-border-muted')}>
                        <td className="px-3 py-1.5 font-mono text-[10.5px] text-subtle-foreground">{email.id}</td>
                        <td className="px-2 py-1.5">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <CategoryChip category={email.got} short />
                            {email.expected !== email.got && (
                              <span className="text-[10.5px] text-destructive">expected {email.expected}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <span
                            className={cx(
                              'inline-flex size-5 items-center justify-center rounded-full',
                              email.pass ? 'bg-[#eaf5ee] text-label-green dark:bg-[#1e3126]' : 'bg-[#fdf0ee] text-destructive dark:bg-[#3a2320]',
                            )}
                          >
                            {email.pass ? <Check className="size-3" /> : <Minus className="size-3" />}
                            <span className="sr-only">{email.pass ? 'Pass' : 'Miss'}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-5">
              <section>
                <SectionHeading title="By field" aside="Deal records" />
                <ul className="space-y-2 rounded-[13px] border border-border-muted p-3.5">
                  {report.byField.map((field) => (
                    <li key={field.key} className="flex items-center gap-2.5">
                      <span className="w-[92px] shrink-0 text-[11.5px] text-muted-foreground">{field.label}</span>
                      <Meter value={field.passed / Math.max(1, field.total)} tone={field.passed === field.total ? 'ink' : 'quiet'} className="flex-1" />
                      <span className="w-9 text-right text-[11px] tabular-nums">
                        {field.passed}/{field.total}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[13px] bg-muted p-3.5 text-[11.5px] leading-[17px] text-muted-foreground shadow-sunk">
                <p className="flex items-center gap-1.5 font-medium text-secondary-foreground">
                  <FlaskConical aria-hidden className="size-3.5" />
                  What this does not prove
                </p>
                <ul className="mt-1.5 space-y-1">
                  <li>· It does not prove generalisation to a new inbox.</li>
                  <li>· 15 emails is too small for a rate; treat the fractions as a checklist.</li>
                  <li>· One annotator means one reading of “debatable”.</li>
                  <li>· The next step is 100+ emails labelled by another creator before tuning.</li>
                </ul>
              </section>
            </div>
          </div>

          <section>
            <SectionHeading title="Every deal" aside={`${report.exactDeals} exact · ${report.totalDeals} deals`} />
            <ul className="overflow-hidden rounded-[13px] bg-card shadow-raised">
              {report.deals.map((deal, i) => {
                const missed = deal.fields.filter((f) => !f.pass)
                return (
                  <li key={deal.brandKey} className={cx('px-3.5 py-2.5', i > 0 && 'border-t border-border-muted')}>
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="text-[12.5px] font-medium">{deal.brand}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {deal.fields.length - missed.length}/{deal.fields.length} fields
                      </span>
                      <span
                        className={cx(
                          'ml-auto rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium',
                          deal.pass ? 'bg-[#eaf5ee] text-label-green dark:bg-[#1e3126]' : 'bg-[#fdf0ee] text-destructive dark:bg-[#3a2320]',
                        )}
                      >
                        {deal.pass ? 'exact' : 'check'}
                      </span>
                    </div>
                    {missed.length > 0 && (
                      <p className="mt-1 text-[11px] text-destructive">
                        {missed.map((f) => `${f.label}: expected ${f.expected}, got ${f.got}`).join(' · ')}
                      </p>
                    )}
                    {deal.debatable && (
                      <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
                        <CircleHelp aria-hidden className="mt-px size-3 shrink-0" />
                        {deal.debatable}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <SectionHeading title="Where a careful reader could disagree" aside={`${altRows.length} emails with a second reading`} />
            <div className="overflow-hidden rounded-[13px] border border-border-muted">
              <table className="w-full table-fixed text-[12px]">
                <thead>
                  <tr className="border-b border-border-muted bg-muted/50 text-left text-[11px] text-muted-foreground">
                    <th className="w-16 px-3 py-2 font-medium">Email</th>
                    <th className="w-[120px] px-2 py-2 font-medium">Expected</th>
                    <th className="w-[120px] px-2 py-2 font-medium">Alternative</th>
                    <th className="px-2 py-2 font-medium">Why it is arguable</th>
                  </tr>
                </thead>
                <tbody>
                  {altRows.map((email, i) => (
                    <tr key={email.id} className={cx(i > 0 && 'border-t border-border-muted')}>
                      <td className="px-3 py-2 font-mono text-[10.5px] text-subtle-foreground">{email.id}</td>
                      <td className="px-2 py-2">
                        <CategoryChip category={email.expected} short />
                      </td>
                      <td className="px-2 py-2">
                        <CategoryChip category={ALTERNATIVE_LABELS[email.id]} short />
                      </td>
                      <td className="px-2 py-2 text-[11.5px] leading-4 text-muted-foreground">
                        {email.id === 'E-06' && 'A strict reader could call a below-rate, incomplete brief a deal offer.'}
                        {email.id === 'E-09' && 'The barter is so far below the work that “not a fit” is defensible.'}
                        {email.id === 'E-12' && 'The date cannot be delivered as written, so it could be “not a fit” rather than “ask”.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 px-1 text-[11px] leading-4 text-subtle-foreground">
              The engine is checked against both readings. Under the alternatives it scores {report.alternativeCorrect}/{report.categoryTotal};
              the three differences are a matter of policy, not extraction, and the profile is what settles them.
            </p>
          </section>
        </div>
      </div>
    </PageSurface>
  )
}

function Score({ label, value, note, pass, neutral = false }: { label: string; value: string; note: string; pass: boolean; neutral?: boolean }) {
  return (
    <div className="p-4 max-sm:border-t max-sm:first:border-t-0 sm:border-l sm:first:border-l-0">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[24px] leading-7 font-semibold tracking-[-0.03em] tabular-nums">
        {value}
        {!neutral && (
          <span
            className={cx(
              'inline-flex size-4 items-center justify-center rounded-full',
              pass ? 'bg-[#eaf5ee] text-label-green dark:bg-[#1e3126]' : 'bg-quiet-soft text-quiet-ink',
            )}
          >
            {pass ? <Check className="size-2.5" /> : <Minus className="size-2.5" />}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-subtle-foreground">{note}</p>
    </div>
  )
}
