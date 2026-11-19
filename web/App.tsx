import { Inbox, ListChecks, Moon, Sun } from 'lucide-react'
import { useMemo, useState } from 'react'
import raw from '../out/analysis.json'
import type { Analysis, Deal } from '../src/types'
import { DealDetail } from './DealDetail'
import { cx, dueText, go, offerText, scopeText, shortDate, useIsDesktop, useRoute, useTheme } from './lib'
import { ACTION, ActionChip, BrandTile, CategoryChip, Segmented, SEVERITY } from './ui'

// The UI renders exactly what `npm run analyze` wrote. It runs no logic of its own.
const analysis = raw as unknown as Analysis

type Filter = 'all' | 'reply' | 'decline' | 'leave'
const GROUPS: { id: Exclude<Filter, 'all'>; title: string }[] = [
  { id: 'reply', title: 'Reply to these' },
  { id: 'decline', title: 'Decline politely' },
  { id: 'leave', title: 'Leave alone' },
]

function Sidebar({ view }: { view: 'today' | 'inbox' }) {
  const { dark, toggle } = useTheme()
  const reply = analysis.deals.filter((d) => ACTION[d.action].group === 'reply').length
  const items = [
    { id: 'today' as const, label: 'Today', icon: ListChecks, count: reply },
    { id: 'inbox' as const, label: 'Inbox', icon: Inbox, count: analysis.emails.length },
  ]
  return (
    <aside className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-1 lg:w-[228px] lg:flex-col lg:items-stretch lg:gap-0 lg:px-3 lg:pt-4 lg:pb-3">
      <div className="flex items-center gap-2.5 lg:px-1.5 lg:pb-6">
        <img src="/favicon.svg" alt="" className="size-7 rounded-[8px] shadow-ink" />
        <span className="hidden text-[14px] font-semibold tracking-[-0.01em] sm:inline">Winnow</span>
      </div>
      <p className="hidden px-2 pb-1.5 text-[12px] text-muted-foreground lg:block">{analysis.generatedFor}</p>
      <nav className="flex flex-1 items-center justify-center gap-1 lg:flex-none lg:flex-col lg:items-stretch lg:gap-0.5">
        {items.map(({ id, label, icon: Icon, count }) => (
          <a
            key={id}
            href={`#/${id}`}
            aria-current={view === id ? 'page' : undefined}
            className={cx(
              'flex h-8 items-center gap-2 rounded-[9px] px-2.5 text-[13.5px] transition-colors',
              view === id ? 'bg-card font-medium text-foreground shadow-raised' : 'text-secondary-foreground hover:bg-accent',
            )}
          >
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            {label}
            <span className="ml-1 text-[12px] font-normal text-muted-foreground tabular-nums lg:ml-auto">{count}</span>
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2 lg:mt-auto lg:px-1.5">
        <p className="hidden min-w-0 flex-1 text-[11.5px] leading-snug text-subtle-foreground lg:block">
          {analysis.stats.mode === 'replay' ? 'Recorded run' : 'Live run'}
          <br />
          {analysis.stats.model}
        </p>
        <button
          type="button"
          onClick={toggle}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-card text-secondary-foreground shadow-raised hover:shadow-raised-hover active:translate-y-px"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
    </aside>
  )
}

function DealRow({ deal, current }: { deal: Deal; current: boolean }) {
  // Terms are only meaningful for real outreach. A scam's "fee" is bait, not an offer.
  const real = deal.category !== 'scam_or_phishing' && deal.category !== 'spam'
  const due = real ? dueText(analysis.today, deal) : null
  const top = deal.flags[0]
  const facts = !real ? '' : [deal.terms.fee || deal.terms.giftValue ? offerText(deal.terms) : null, scopeText(deal.terms)].filter(Boolean).join(' · ')
  return (
    <a
      href={`#/today/${deal.id}`}
      aria-current={current ? 'true' : undefined}
      className={cx('flex gap-3 rounded-[12px] px-3 py-3 transition-colors', current ? 'bg-selected' : 'hover:bg-muted')}
    >
      <BrandTile name={deal.brand} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{deal.brand}</p>
          <ActionChip action={deal.action} />
        </div>
        {(facts || due) && (
          <p className="mt-1 truncate text-[12.5px] text-secondary-foreground tabular-nums">
            {facts}
            {facts && due ? ' · ' : ''}
            {due && <span className={cx(due.urgent && 'font-medium text-quiet-ink')}>due {due.text}</span>}
          </p>
        )}
        {top && (
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', SEVERITY[top.severity].dot)} />
            <span className="truncate">{top.title}</span>
            {deal.flags.length > 1 && <span className="shrink-0 text-subtle-foreground">+{deal.flags.length - 1}</span>}
          </p>
        )}
      </div>
    </a>
  )
}

function Today({ selectedId }: { selectedId: string | null }) {
  const [filter, setFilter] = useState<Filter>('all')
  const desktop = useIsDesktop()
  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.id, analysis.deals.filter((d) => ACTION[d.action].group === g.id).length])), [])
  const visible = analysis.deals.filter((d) => filter === 'all' || ACTION[d.action].group === filter)
  const selected = analysis.deals.find((d) => d.id === selectedId) ?? (desktop ? visible[0] : undefined)

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section className={cx('min-h-0 w-full flex-col lg:flex lg:w-[420px] lg:shrink-0 lg:border-r lg:border-border-muted xl:w-[460px]', selected && !desktop ? 'hidden' : 'flex')}>
        <header className="shrink-0 px-4 pt-4 pb-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[16px] font-semibold tracking-[-0.02em]">Today</h1>
            <span className="text-[13px] text-muted-foreground">{shortDate(analysis.today, true)}</span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {analysis.emails.length} emails became {analysis.deals.length} conversations. {counts.reply} need a reply from you.
          </p>
          <div className="mt-3">
            <Segmented
              label="Filter deals"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: 'All', count: analysis.deals.length },
                { id: 'reply', label: 'Reply', count: counts.reply },
                { id: 'decline', label: 'Decline', count: counts.decline },
                { id: 'leave', label: 'Leave alone', count: counts.leave },
              ]}
            />
          </div>
        </header>
        <div data-scrollbar className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {GROUPS.filter((g) => filter === 'all' || filter === g.id).map((g) => {
            const deals = visible.filter((d) => ACTION[d.action].group === g.id)
            if (!deals.length) return null
            return (
              <div key={g.id} className="mt-2 first:mt-0">
                <p className="px-3 pt-2 pb-1 text-[12px] text-muted-foreground">{g.title}</p>
                {deals.map((d) => (
                  <DealRow key={d.id} deal={d} current={selected?.id === d.id} />
                ))}
              </div>
            )
          })}
        </div>
      </section>
      {selected && (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DealDetail deal={selected} analysis={analysis} onBack={() => go('/today')} />
        </section>
      )}
    </div>
  )
}

function InboxView() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[16px] font-semibold tracking-[-0.02em]">Inbox</h1>
          <span className="text-[13px] text-muted-foreground tabular-nums">{analysis.emails.length}</span>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">Every email, what it is, and the conversation it belongs to.</p>
      </header>
      <div data-scrollbar className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <div className="hidden grid-cols-[64px_minmax(0,1.1fr)_minmax(0,2fr)_170px_150px] gap-3 border-b border-border-muted px-3 py-2 text-[12px] text-muted-foreground md:grid">
          <span>Email</span>
          <span>From</span>
          <span>Subject</span>
          <span>Category</span>
          <span>Conversation</span>
        </div>
        {analysis.emails.map((e) => {
          const deal = analysis.deals.find((d) => d.id === e.dealId)!
          return (
            <a key={e.id} href={`#/today/${deal.id}`} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-[10px] px-3 py-2.5 hover:bg-muted md:grid-cols-[64px_minmax(0,1.1fr)_minmax(0,2fr)_170px_150px] md:items-center md:py-2">
              <span className="hidden font-mono text-[11.5px] text-muted-foreground md:block">{e.id}</span>
              <span className="order-1 min-w-0 truncate text-[13.5px] font-medium md:order-none md:font-normal">{e.from}</span>
              <span className="order-4 col-span-2 min-w-0 md:order-none md:col-span-1">
                <span className="block truncate text-[13.5px]">{e.subject}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">{e.summary ?? e.categoryReason}</span>
              </span>
              <span className="order-2 justify-self-end md:order-none md:justify-self-start">
                <CategoryChip category={e.category} />
              </span>
              <span className="order-5 col-span-2 min-w-0 truncate text-[12.5px] text-muted-foreground md:order-none md:col-span-1 md:text-[13px] md:text-secondary-foreground">
                <span className="font-mono text-[11.5px] md:hidden">{e.id} · </span>
                {deal.brand} · {ACTION[deal.action].label.toLowerCase()}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

export function App() {
  const route = useRoute()
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <Sidebar view={route.view} />
      <main className="flex min-h-0 min-w-0 flex-1 p-2 lg:pl-0">
        <div className="etched flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[14px] bg-background shadow-surface">
          {route.view === 'inbox' ? <InboxView /> : <Today selectedId={route.id} />}
        </div>
      </main>
    </div>
  )
}
