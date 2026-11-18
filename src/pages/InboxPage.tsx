import { useEffect, useRef } from 'react'
import type { Analysis, Category, EmailAnalysis } from '../engine/types'
import { cx } from '../lib/cx'
import { receivedLabel, receivedTime, CATEGORY_ORDER, plural } from '../lib/format'
import { CATEGORY_META } from '../lib/meta'
import type { ViewState } from '../state/useUrlState'
import { MobileSelect, NoResults, PageHeader, PageStrip, PageSurface, SearchField, Segmented, StripSummary } from '../components/Page'
import { BrandTile, CategoryChip, Kbd } from '../components/ui/primitives'

export function InboxPage({
  analysis,
  state,
  update,
  onOpenEmail,
}: {
  analysis: Analysis
  state: ViewState
  update: (patch: Partial<ViewState>, push?: boolean) => void
  onOpenEmail: (email: EmailAnalysis) => void
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

  const dealOf = (emailId: string) => analysis.deals.find((d) => d.emails.some((e) => e.id === emailId))
  const emails = [...analysis.emails]
    .filter((email) => {
      if (state.category !== 'all' && email.category !== state.category) return false
      if (!q) return true
      return [email.brand, email.from, email.subject, email.body].join(' ').toLowerCase().includes(q)
    })
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  const days = [...new Set(emails.map((e) => e.receivedAt.slice(0, 10)))]
  const counts = analysis.summary.counts.byCategory
  const unread = emails.length

  return (
    <PageSurface>
      <PageHeader
        title="Inbox"
        count={`${unread}${unread !== analysis.emails.length ? ` of ${analysis.emails.length}` : ''}`}
        actions={
          <SearchField
            value={state.q}
            onChange={(next) => update({ q: next })}
            label="Search the inbox"
            placeholder="Sender, subject, body"
            inputRef={searchRef}
            className="w-[190px] sm:w-[240px]"
          />
        }
      />

      <PageStrip>
        <Segmented<Category | 'all'>
          label="Category"
          value={state.category}
          onChange={(category) => update({ category })}
          className="max-sm:hidden"
          options={[
            { id: 'all', label: 'All', count: analysis.emails.length },
            ...CATEGORY_ORDER.map((category) => ({ id: category, label: CATEGORY_META[category].short, count: counts[category] })),
          ]}
        />
        <MobileSelect<Category | 'all'>
          label="Category"
          value={state.category}
          onChange={(category) => update({ category })}
          options={[
            { id: 'all', label: 'All categories', count: analysis.emails.length },
            ...CATEGORY_ORDER.map((category) => ({ id: category, label: CATEGORY_META[category].label, count: counts[category] })),
          ]}
        />
        <StripSummary>
          <span>{plural(analysis.summary.counts.deals, 'deal')} after grouping</span>
          <span>Every email read as data</span>
        </StripSummary>
      </PageStrip>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" data-scrollbar>
        {emails.length === 0 ? (
          <NoResults
            title="No emails match"
            detail="Try all categories, or clear the search to see the whole inbox again."
            onClear={() => update({ q: '', category: 'all' })}
          />
        ) : (
          days.map((day) => {
            const rows = emails.filter((e) => e.receivedAt.slice(0, 10) === day)
            return (
              <section key={day} aria-label={receivedLabel(`${day}T00:00`)}>
                <h2 className="sticky top-0 z-10 flex items-baseline gap-2 bg-background px-2 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">
                  {receivedLabel(`${day}T00:00`)}
                  <span className="text-subtle-foreground tabular-nums">{rows.length}</span>
                </h2>
                <ul className="overflow-hidden rounded-[12px] bg-card shadow-raised">
                  {rows.map((email, i) => {
                    const deal = dealOf(email.id)
                    const open = state.emailId === email.id
                    return (
                      <li key={email.id} className={cx(i > 0 && 'border-t border-border-muted')}>
                        <button
                          type="button"
                          onClick={() => onOpenEmail(email)}
                          data-row
                          data-current={open || undefined}
                          className={cx(
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                            open ? 'bg-selected' : 'hover:bg-muted',
                          )}
                        >
                          <BrandTile name={email.brand} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <span
                                  aria-hidden
                                  title={CATEGORY_META[email.category].label}
                                  className={cx('size-1.5 shrink-0 rounded-[2px] sm:hidden', CATEGORY_META[email.category].dot)}
                                />
                                <span className="truncate text-[12.5px] font-medium">{email.from}</span>
                              </span>
                              {email.injection && (
                                <span className="shrink-0 rounded-[5px] bg-[#fdf0ee] px-1 text-[9.5px] font-medium tracking-wide text-destructive uppercase dark:bg-[#3a2320]">
                                  injection
                                </span>
                              )}
                              <span className="ml-auto shrink-0 text-[10.5px] text-subtle-foreground tabular-nums">{receivedTime(email.receivedAt)}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] font-medium text-secondary-foreground">{email.subject}</span>
                            <span className="mt-0.5 block truncate text-[11.5px] text-subtle-foreground">{excerpt(email.body)}</span>
                          </span>
                          <span className="hidden shrink-0 items-center gap-2.5 sm:flex">
                            {deal && deal.emails.length > 1 && (
                              <span className="text-[10.5px] text-subtle-foreground tabular-nums">{deal.emails.length} in thread</span>
                            )}
                            <CategoryChip category={email.category} short />
                            <Kbd className="max-lg:hidden">↵</Kbd>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })
        )}

        <p className="px-3 pt-4 pb-2 text-[11px] text-subtle-foreground">
          {plural(emails.length, 'email')} shown · attachments are never opened · content is parsed as data
        </p>
      </div>
    </PageSurface>
  )
}

function excerpt(body: string) {
  const line = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !/^(hi|hello|hey|dear|namaste)\b/i.test(l))
  return (line ?? body).replace(/\s+/g, ' ').slice(0, 150)
}
