import { ArrowRight, Ban, Clock, Inbox, MailOpen, Sparkles } from 'lucide-react'
import type { Analysis, AttentionItem } from '../engine/types'
import { cx } from '../lib/cx'
import { plural, shortInr, weekdayDate, whenLabel } from '../lib/format'
import { CATEGORY_META } from '../lib/meta'
import { PageHeader, PageSurface, SectionHeading } from '../components/Page'
import { Button } from '../components/ui/Button'
import { ActionChip, BrandTile, Meter } from '../components/ui/primitives'
import type { Page } from '../state/useUrlState'

const isReply = (item: AttentionItem) => ['accept', 'negotiate', 'ask_for_details'].includes(item.action)

export function TodayPage({
  analysis,
  onOpenDeal,
  onNavigate,
}: {
  analysis: Analysis
  onOpenDeal: (id: string) => void
  onNavigate: (page: Page) => void
}) {
  const { summary, deals } = analysis
  const reply = summary.attention.filter(isReply)
  const declines = summary.attention.filter((a) => a.action === 'decline')
  const blocked = summary.blocked
  const maxCategory = Math.max(...Object.values(summary.counts.byCategory))
  const deadlines = deals
    .filter((d) => d.terms.deadline.date)
    .sort((a, b) => (a.terms.deadline.date ?? '').localeCompare(b.terms.deadline.date ?? ''))
    .slice(0, 3)

  return (
    <PageSurface>
      <PageHeader
        title="Today"
        count={weekdayDate(analysis.today)}
        actions={
          <Button size="sm" onClick={() => onNavigate('deals')}>
            All deals
            <ArrowRight />
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8" data-scrollbar>
        <div className="mx-auto max-w-[1080px] space-y-6 pt-1">
          <header className="max-w-[720px] pt-1">
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium tracking-[0.02em] text-muted-foreground">
              <Sparkles aria-hidden className="size-3.5" />
              The desk read all {summary.counts.emails} emails. Here is what survives.
            </p>
            <h2 className="mt-2 text-[26px] leading-[33px] font-semibold tracking-[-0.035em] text-balance md:text-[30px] md:leading-[38px]">
              {shortInr(summary.money.actionableInr)} is worth a reply today.{' '}
              <span className="text-muted-foreground">{shortInr(summary.money.blockedInr)} is not, at any price.</span>
            </h2>
            <p className="mt-3 max-w-[620px] text-[13px] leading-[20px] text-muted-foreground">{summary.paragraphs[0]}</p>
          </header>

          <section aria-label="Money">
            <div className="grid overflow-hidden rounded-[13px] bg-card shadow-raised sm:grid-cols-3">
              <MoneyCell label="Worth a reply" value={summary.money.actionableInr} note="Cash in deals you should answer" tone="ink" />
              <MoneyCell label="Offers on the table" value={summary.money.offeredInr} note={`${plural(deals.length, 'deal')} after grouping threads`} />
              <MoneyCell label="Blocked by your rules" value={summary.money.blockedInr} note="Do not take this, however it is framed" tone="quiet" />
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-subtle-foreground">
              {shortInr(summary.money.belowRateInr)} sits under your rate · {shortInr(summary.money.atOrAboveRateInr)} at or above it · fees
              converted at ₹84/$
            </p>
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-6">
              <section aria-labelledby="needs-you">
                <SectionHeading
                  title={<span id="needs-you">Needs you today</span>}
                  aside={`${reply.length} ${reply.length === 1 ? 'reply' : 'replies'} to write`}
                />
                <ol className="overflow-hidden rounded-[13px] bg-card shadow-raised">
                  {reply.map((item, i) => (
                    <AttentionRow key={item.dealId} item={item} index={i} onOpen={() => onOpenDeal(item.dealId)} />
                  ))}
                </ol>
                {reply.length === 0 && <p className="rounded-[13px] bg-card px-4 py-6 text-center text-[13px] text-muted-foreground shadow-raised">Nothing needs a reply. The inbox is clear.</p>}
              </section>

              <section aria-labelledby="clear-no">
                <SectionHeading title={<span id="clear-no">A clear no</span>} aside={`${declines.length} declines`} />
                <ul className="overflow-hidden rounded-[13px] border border-border-muted">
                  {declines.map((item, i) => (
                    <li key={item.dealId} className={cx(i > 0 && 'border-t border-border-muted')}>
                      <button
                        type="button"
                        onClick={() => onOpenDeal(item.dealId)}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <Ban aria-hidden className="size-3.5 shrink-0 text-label-violet" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">{item.brand}</span>
                          <span className="block truncate text-[11.5px] text-muted-foreground">{item.line}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-subtle-foreground">Decline</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="blocked">
                <SectionHeading title={<span id="blocked">Do not answer</span>} aside={`${blocked.length} blocked`} />
                <ul className="overflow-hidden rounded-[13px] bg-muted shadow-sunk">
                  {blocked.map((item, i) => (
                    <li key={item.dealId} className={cx('flex items-center gap-2.5 px-3 py-2.5', i > 0 && 'border-t border-border')}>
                      <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground shadow-raised">
                        {item.action === 'report' ? <Ban className="size-3" /> : <Inbox className="size-3" />}
                      </span>
                      <button type="button" onClick={() => onOpenDeal(item.dealId)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[12.5px] font-medium">{item.brand}</span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">{item.line}</span>
                      </button>
                      <span className={cx('shrink-0 text-[11px]', item.action === 'report' ? 'text-destructive' : 'text-subtle-foreground')}>
                        {item.action === 'report' ? 'Report' : 'Ignore'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[13px] bg-card p-3.5 shadow-raised">
                <SectionHeading title="Inbox shape" aside={plural(summary.counts.emails, 'email')} />
                <ul className="space-y-2.5">
                  {(Object.keys(summary.counts.byCategory) as (keyof typeof summary.counts.byCategory)[]).map((key) => (
                    <li key={key} className="flex items-center gap-2">
                      <span aria-hidden className={cx('size-1.5 shrink-0 rounded-[2px]', CATEGORY_META[key].dot)} />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-secondary-foreground">{CATEGORY_META[key].label}</span>
                      <Meter
                        value={summary.counts.byCategory[key] / maxCategory}
                        tone={key === 'scam_or_phishing' ? 'quiet' : 'ink'}
                        className="w-14"
                      />
                      <span className="w-4 text-right text-[11.5px] text-muted-foreground tabular-nums">{summary.counts.byCategory[key]}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[13px] border border-border-muted p-3.5">
                <SectionHeading title="Dates that matter" aside={<Clock className="size-3.5" />} />
                {deadlines.length ? (
                  <ul className="space-y-2">
                    {deadlines.map((deal) => {
                      const due = whenLabel(deal, analysis.today)
                      return (
                        <li key={deal.id}>
                          <button type="button" onClick={() => onOpenDeal(deal.id)} className="flex w-full items-baseline gap-2 text-left">
                            <span className="min-w-0 flex-1 truncate text-[12px]">{deal.brand}</span>
                            <span className={cx('shrink-0 text-[11px] tabular-nums', due.late ? 'text-destructive' : 'text-muted-foreground')}>
                              {due.date}
                              {due.suffix && ` · ${due.suffix}`}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-[12px] text-muted-foreground">No dated deadlines in the reply pile.</p>
                )}
              </section>

              <section className="rounded-[13px] bg-muted p-3.5 text-[11.5px] leading-[17px] text-muted-foreground shadow-sunk">
                <p className="flex items-center gap-1.5 font-medium text-secondary-foreground">
                  <MailOpen aria-hidden className="size-3.5" />
                  {summary.attention.length + blocked.length} open decisions
                </p>
                <p className="mt-1">
                  {Object.values(summary.counts.byAction).reduce((n, v) => n + v, 0)} deals,{' '}
                  {summary.counts.byAction.report + summary.counts.byAction.ignore} of them not worth a word. Nothing has been sent.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('evaluation')}
                  className="mt-2 inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                >
                  See how the desk scored
                  <ArrowRight className="size-3" />
                </button>
              </section>
            </aside>
          </div>

          <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-muted pt-3 text-[11px] text-subtle-foreground">
            <span>{plural(summary.counts.emails, 'email')} · {plural(summary.counts.deals, 'deal')} · nothing sent</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-label-green" />
              Drafts are for review only
            </span>
          </footer>
        </div>
      </div>
    </PageSurface>
  )
}

function MoneyCell({ label, value, note, tone = 'plain' }: { label: string; value: number; note: string; tone?: 'ink' | 'quiet' | 'plain' }) {
  return (
    <div className={cx('border-border-muted p-4 max-sm:border-t max-sm:first:border-t-0 sm:border-l sm:first:border-l-0', tone === 'quiet' && 'bg-[rgb(var(--shade)/0.02)]')}>
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className={cx('mt-1 text-[23px] leading-7 font-semibold tracking-[-0.03em] tabular-nums', tone === 'quiet' ? 'text-muted-foreground' : 'text-foreground')}>
        {shortInr(value)}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-subtle-foreground">{note}</p>
    </div>
  )
}

function AttentionRow({ item, index, onOpen }: { item: AttentionItem; index: number; onOpen: () => void }) {
  return (
    <li className={cx(index > 0 && 'border-t border-border-muted')}>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted"
      >
        <span className="w-5 shrink-0 font-mono text-[10.5px] text-subtle-foreground tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        <BrandTile name={item.brand} size="md" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-medium">{item.brand}</span>
            <ActionChip action={item.action} />
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{item.line}</span>
        </span>
        <ArrowRight aria-hidden className="size-3.5 shrink-0 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  )
}
