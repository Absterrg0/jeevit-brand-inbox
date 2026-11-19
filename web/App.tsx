import { ChevronDown, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import raw from '../out/analysis.json'
import type { Analysis, Deal } from '../src/types'
import { DealBody } from './DealDetail'
import { cx, dueText, offerText, scopeText, shortDate, useTheme } from './lib'
import { ACTION, ActionChip, BrandTile, CategoryChip, type Bucket } from './ui'

// The UI renders exactly what `npm run analyze` wrote. It runs no logic of its own.
const analysis = raw as unknown as Analysis

const BUCKETS: { id: Bucket; label: string; hint: string; dot: string }[] = [
  { id: 'reply', label: 'Reply', hint: 'need an answer from you', dot: 'bg-label-green' },
  { id: 'decline', label: 'Decline', hint: 'break a rule or exclusivity', dot: 'bg-label-orange' },
  { id: 'report', label: 'Report', hint: 'scams and phishing', dot: 'bg-label-red' },
  { id: 'ignore', label: 'Ignore', hint: 'newsletters and noise', dot: 'bg-subtle-foreground' },
]
const count = (b: Bucket) => analysis.deals.filter((d) => ACTION[d.action].bucket === b).length

function Header() {
  const { dark, toggle } = useTheme()
  return (
    <header className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-7 rounded-[8px] shadow-ink" />
      <span className="text-[14px] font-semibold tracking-[-0.01em]">Winnow</span>
      <span className="text-[13px] text-muted-foreground">{analysis.generatedFor}</span>
      <button
        type="button"
        onClick={toggle}
        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-card text-secondary-foreground shadow-raised hover:shadow-raised-hover active:translate-y-px"
      >
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    </header>
  )
}

function DealCard({ deal, open, onToggle }: { deal: Deal; open: boolean; onToggle: () => void }) {
  // Terms are only meaningful for real outreach. A scam's "fee" is bait, not an offer.
  const real = deal.category !== 'scam_or_phishing' && deal.category !== 'spam'
  const due = real ? dueText(analysis.today, deal) : null
  const facts = !real ? '' : [deal.terms.fee || deal.terms.giftValue ? offerText(deal.terms) : null, scopeText(deal.terms)].filter(Boolean).join(' · ')
  return (
    <li className="overflow-hidden rounded-[14px] bg-card shadow-raised">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full gap-3 px-4 py-3.5 text-left hover:bg-muted sm:px-5">
        <BrandTile name={deal.brand} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{deal.brand}</span>
            <ActionChip action={deal.action} />
          </span>
          {(facts || due) && (
            <span className="mt-1 block text-[13px] text-secondary-foreground tabular-nums">
              {facts}
              {facts && due ? ' · ' : ''}
              {due && <span className={cx(due.urgent && 'font-medium text-quiet-ink')}>due {due.text}</span>}
            </span>
          )}
          <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">{deal.why}</span>
        </span>
        <ChevronDown aria-hidden className={cx('mt-1.5 size-4 shrink-0 text-subtle-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <DealBody deal={deal} analysis={analysis} />}
    </li>
  )
}

export function App() {
  const [bucket, setBucket] = useState<Bucket | null>(null)
  // A link like #D-01 opens that card.
  const [openId, setOpenId] = useState<string | null>(() => window.location.hash.slice(1) || null)
  const deals = analysis.deals.filter((d) => !bucket || ACTION[d.action].bucket === bucket)
  return (
    <div data-scrollbar className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-3 pt-4 pb-16 sm:px-5 sm:pt-6">
        <Header />

        <section>
          <div className="flex items-baseline gap-2">
            <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Today</h1>
            <span className="text-[13px] text-muted-foreground">{shortDate(analysis.today, true)}</span>
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-secondary-foreground">
            {analysis.emails.length} emails, {analysis.deals.length} conversations. {count('reply')} need a reply, {count('decline')} to decline, {count('report')} scams to report, {count('ignore')} to ignore.
          </p>
          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BUCKETS.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={bucket === b.id}
                onClick={() => setBucket(bucket === b.id ? null : b.id)}
                className={cx(
                  'rounded-[12px] px-3.5 py-3 text-left transition-[background-color,box-shadow] active:translate-y-px',
                  bucket === b.id ? 'bg-selected shadow-sunk' : 'bg-card shadow-raised hover:shadow-raised-hover',
                )}
              >
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-secondary-foreground">
                  <span aria-hidden className={cx('size-1.5 rounded-full', b.dot)} />
                  {b.label}
                </span>
                <span className="mt-1 block text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{count(b.id)}</span>
                <span className="mt-1.5 block text-[11.5px] leading-snug text-muted-foreground">{b.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[12px] text-muted-foreground">
            {bucket ? `${deals.length} to ${bucket}` : 'Most important first'} · tap a card for the terms, the reasons and a draft reply
          </p>
          {deals.length ? (
            <ul className="flex flex-col gap-2">
              {deals.map((d) => (
                <DealCard key={d.id} deal={d} open={openId === d.id} onToggle={() => setOpenId(openId === d.id ? null : d.id)} />
              ))}
            </ul>
          ) : (
            <p className="rounded-[12px] bg-muted px-4 py-6 text-center text-[13px] text-muted-foreground shadow-sunk">Nothing here today.</p>
          )}
        </section>

        <details className="rounded-[14px] bg-card shadow-raised">
          <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-medium select-none sm:px-5">All {analysis.emails.length} emails</summary>
          <ul className="divide-y divide-border-muted border-t border-border-muted">
            {analysis.emails.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
                <span className="w-9 shrink-0 font-mono text-[11.5px] text-muted-foreground">{e.id}</span>
                <span className="min-w-0 flex-1 basis-[200px]">
                  <span className="block truncate text-[13px]">{e.subject}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{e.from}</span>
                </span>
                <CategoryChip category={e.category} />
              </li>
            ))}
          </ul>
        </details>

        <p className="px-1 text-[11.5px] leading-relaxed text-subtle-foreground">
          A model reads each email; code checks every quote against the email and does the sums, dates and the decision. Nothing is sent on your behalf.
        </p>
      </div>
    </div>
  )
}
