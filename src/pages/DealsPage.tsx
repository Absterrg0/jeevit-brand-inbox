import { useEffect, useRef } from 'react'
import type { Analysis, Category } from '../engine/types'
import { CATEGORY_ORDER, shortInr } from '../lib/format'
import { CATEGORY_META } from '../lib/meta'
import type { ViewState } from '../state/useUrlState'
import { DealsBoard } from '../components/DealsBoard'
import { DealsTable } from '../components/DealsTable'
import { MobileSelect, NoResults, PageHeader, PageStrip, PageSurface, SearchField, Segmented, SignalToggle, StripSummary } from '../components/Page'

export function DealsPage({
  analysis,
  state,
  update,
  onOpenDeal,
}: {
  analysis: Analysis
  state: ViewState
  update: (patch: Partial<ViewState>, push?: boolean) => void
  onOpenDeal: (id: string) => void
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  const q = state.q.trim().toLowerCase()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const deals = analysis.deals.filter((deal) => {
    if (state.category !== 'all' && deal.category !== state.category) return false
    if (state.riskOnly && deal.risks.length === 0) return false
    if (!q) return true
    return [deal.brand, deal.summary, deal.actionReason, deal.categoryReason, ...deal.terms.notes, ...deal.emails.map((e) => `${e.subject} ${e.from} ${e.body}`)]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })

  const totalFee = deals.reduce((n, d) => n + (d.terms.fee?.inr ?? 0), 0)
  const counts = analysis.summary.counts.byCategory

  return (
    <PageSurface>
      <PageHeader
        title="Deals"
        count={`${deals.length}${deals.length !== analysis.deals.length ? ` of ${analysis.deals.length}` : ''}`}
        actions={<SearchField value={state.q} onChange={(next) => update({ q: next })} label="Search deals" placeholder="Brand, term, email" inputRef={searchRef} className="w-[190px] sm:w-[230px]" />}
      >
        <Segmented
          label="View"
          value={state.view}
          onChange={(view) => update({ view })}
          options={[
            { id: 'table', label: 'Table' },
            { id: 'board', label: 'Board' },
          ]}
        />
      </PageHeader>

      <PageStrip>
        <Segmented<Category | 'all'>
          label="Category"
          value={state.category}
          onChange={(category) => update({ category })}
          className="max-sm:hidden"
          options={[
            { id: 'all', label: 'All', count: analysis.deals.length },
            ...CATEGORY_ORDER.map((category) => ({ id: category, label: CATEGORY_META[category].short, count: counts[category] })),
          ]}
        />
        <MobileSelect<Category | 'all'>
          label="Category"
          value={state.category}
          onChange={(category) => update({ category })}
          options={[
            { id: 'all', label: 'All categories', count: analysis.deals.length },
            ...CATEGORY_ORDER.map((category) => ({ id: category, label: CATEGORY_META[category].label, count: counts[category] })),
          ]}
        />
        <SignalToggle active={state.riskOnly} onToggle={() => update({ riskOnly: !state.riskOnly })} tip="Only deals with a risk flag">
          Risk flags
        </SignalToggle>
        <StripSummary>
          <span>
            <span className="font-medium text-foreground">{deals.length}</span> shown
          </span>
          <span>
            <span className="font-medium text-foreground">{shortInr(totalFee)}</span> in fees
          </span>
          <span>
            <span className="font-medium text-foreground">{analysis.summary.counts.byAction.negotiate + analysis.summary.counts.byAction.ask_for_details}</span> to answer
          </span>
        </StripSummary>
      </PageStrip>

      <div className="min-h-0 flex-1">
        {deals.length === 0 ? (
          <NoResults
            title="No deals match"
            detail="Try another category, clear the risk filter, or search for a brand by name."
            onClear={() => update({ q: '', category: 'all', riskOnly: false })}
          />
        ) : state.view === 'board' ? (
          <DealsBoard deals={deals} today={analysis.today} openId={state.dealId} onOpen={onOpenDeal} />
        ) : (
          <DealsTable deals={deals} today={analysis.today} openId={state.dealId} onOpen={onOpenDeal} />
        )}
      </div>
    </PageSurface>
  )
}
