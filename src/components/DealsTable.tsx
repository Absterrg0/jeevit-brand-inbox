import { ArrowDown, ArrowUp, CornerDownRight } from 'lucide-react'
import { useState } from 'react'
import type { Deal } from '../engine/types'
import { deliverableText } from '../engine/assess'
import { cx } from '../lib/cx'
import { deltaLabel, money, moneyNote, whenLabel } from '../lib/format'
import { CATEGORY_META } from '../lib/meta'
import { ActionChip, BrandTile, DealRowMeta, Empty, Kbd, RiskBadge } from './ui/primitives'

type Group = { key: string; label: string; hint: string; rows: Deal[] }
type SortKey = 'brand' | 'fee' | 'rate' | 'due' | 'risk'

const GROUPS: { key: string; label: string; hint: string; actions: Deal['action'][] }[] = [
  { key: 'reply', label: 'Worth a reply', hint: 'Accept, counter or ask before saying yes', actions: ['accept', 'negotiate', 'ask_for_details'] },
  { key: 'decline', label: 'Decline', hint: 'Real offers your rules say no to', actions: ['decline'] },
  { key: 'none', label: 'No reply', hint: 'Report or ignore; never engage', actions: ['report', 'ignore'] },
]

const INSET = 8
const headCell = 'h-9 border-y border-border-muted bg-background px-3 text-left align-middle font-normal'

export function DealsTable({
  deals,
  today,
  openId,
  onOpen,
}: {
  deals: Deal[]
  today: string
  openId: string | null
  onOpen: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)

  const comparator = (a: Deal, b: Deal) => {
    if (!sort) return b.priority - a.priority
    const sign = sort.dir === 'asc' ? 1 : -1
    switch (sort.key) {
      case 'brand':
        return sign * a.brand.localeCompare(b.brand)
      case 'fee':
        return sign * ((a.terms.fee?.inr ?? -1) - (b.terms.fee?.inr ?? -1))
      case 'rate':
        return sign * ((a.rate.pct ?? -999) - (b.rate.pct ?? -999))
      case 'due':
        return sign * ((a.terms.deadline.date ?? '9999').localeCompare(b.terms.deadline.date ?? '9999'))
      case 'risk':
        return sign * (a.riskScore - b.riskScore)
    }
  }

  const groups: Group[] = GROUPS.map((g) => ({
    ...g,
    rows: deals.filter((d) => g.actions.includes(d.action)).sort(comparator),
  })).filter((g) => g.rows.length)
  const total = groups.reduce((n, g) => n + g.rows.length, 0)

  function cycle(key: SortKey) {
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  }

  function Header({ label, k, align = 'left' }: { label: string; k?: SortKey; align?: 'left' | 'right' }) {
    const active = sort?.key === k
    const Arrow = sort?.dir === 'desc' ? ArrowDown : ArrowUp
    const base = cx('flex w-full items-center gap-1 text-xs font-medium text-muted-foreground', align === 'right' && 'justify-end')
    const inner = (
      <>
        <span className="truncate">{label}</span>
        {active && <Arrow aria-hidden className="size-3 shrink-0 text-foreground" />}
      </>
    )
    if (!k) return <span className={base}>{inner}</span>
    return (
      <button
        type="button"
        onClick={() => cycle(k)}
        className={cx(base, '-mx-1.5 rounded-[7px] px-1.5 py-1 hover:bg-accent hover:text-foreground', active && 'text-foreground')}
      >
        {inner}
      </button>
    )
  }

  if (!total) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-muted-foreground">
        No deals match this view.
      </div>
    )
  }

  return (
    <>
      {/* On a phone the table would scroll sideways; the same groups become a tap list. */}
      <div className="h-full overflow-y-auto px-2 pb-3 md:hidden" data-scrollbar>
        {groups.map((group) => (
          <section key={group.key} className="pt-2">
            <h3 className="flex items-baseline gap-2 px-2 pb-1.5 text-xs font-medium text-muted-foreground">
              {group.label}
              <span className="text-subtle-foreground tabular-nums">{group.rows.length}</span>
            </h3>
            <ul className="overflow-hidden rounded-[12px] bg-card shadow-raised">
              {group.rows.map((deal, i) => {
                const fee = money(deal.terms.fee)
                const due = whenLabel(deal, today)
                const scope = deal.terms.deliverables.length ? deliverableText(deal.terms.deliverables) : 'Scope not stated'
                return (
                  <li key={deal.id} className={cx(i > 0 && 'border-t border-border-muted')}>
                    <button
                      type="button"
                      onClick={() => onOpen(deal.id)}
                      className={cx('w-full px-3 py-2.5 text-left transition-colors', deal.id === openId ? 'bg-selected' : 'hover:bg-muted')}
                    >
                      <span className="flex items-start gap-2.5">
                        <BrandTile name={deal.brand} size="sm" className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="truncate text-[13px] font-medium">{deal.brand}</span>
                            <span className="ml-auto shrink-0 text-[12px] font-medium tabular-nums">{fee ?? 'No fee'}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {scope} · {deal.emails.length === 1 ? '1 email' : `${deal.emails.length} emails`} ·{' '}
                            <span className={cx(due.late && 'text-destructive')}>{due.date}</span>
                          </span>
                          <span className="mt-1.5 flex items-center gap-2">
                            <ActionChip action={deal.action} />
                            <RiskBadge risks={deal.risks} score={deal.riskScore} className="ml-auto" />
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <p className="px-3 pt-3 pb-1 text-[11px] text-subtle-foreground">Latest terms win when a thread changes. Drafts are never sent.</p>
      </div>

      <div className="hidden h-full overflow-auto overscroll-contain px-2 pb-3 md:block" data-scrollbar>
      <table className="w-full min-w-[820px] table-fixed border-separate [border-spacing:0_2px] text-[13px]">
        <caption className="sr-only">Deals, grouped by what to do next. Press Enter on a row to open it.</caption>
        <thead className="sticky top-0 z-20">
          <tr>
            <th scope="col" style={{ width: 268 }} className={cx(headCell, 'sticky left-2 z-10')}>
              <Header label="Deal" k="brand" />
            </th>
            <th scope="col" style={{ width: 138 }} className={headCell}>
              <Header label="Next step" />
            </th>
            <th scope="col" style={{ width: 132 }} className={headCell}>
              <Header label="Fee" k="fee" align="right" />
            </th>
            <th scope="col" style={{ width: 158 }} className={headCell}>
              <Header label="Against rate" k="rate" align="right" />
            </th>
            <th scope="col" style={{ width: 118 }} className={headCell}>
              <Header label="Due" k="due" />
            </th>
            <th scope="col" style={{ width: 124 }} className={headCell}>
              <Header label="Category" />
            </th>
            <th scope="col" style={{ width: 88 }} className={headCell}>
              <Header label="Risk" k="risk" align="right" />
            </th>
            <th aria-hidden className={headCell} />
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key}>
            <tr>
              <th scope="colgroup" colSpan={8} className="h-10 px-0 pt-3 text-left align-bottom font-normal">
                <span className="sticky left-2 flex items-center gap-2 px-3 pb-1">
                  <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                  <span className="text-xs text-subtle-foreground tabular-nums">{group.rows.length}</span>
                  <span className="hidden text-[11px] text-subtle-foreground sm:inline">{group.hint}</span>
                </span>
              </th>
            </tr>
            {group.rows.map((deal) => {
              const open = deal.id === openId
              const fee = money(deal.terms.fee)
              const note = moneyNote(deal.terms.fee)
              const due = whenLabel(deal, today)
              const delta = deltaLabel(deal)
              const cell = cx(
                'h-[44px] px-3 align-middle transition-colors duration-75 first:rounded-l-[10px] last:rounded-r-[10px]',
                open ? 'bg-selected' : 'bg-background',
              )
              return (
                <tr key={deal.id} data-row data-current={open || undefined} onClick={() => onOpen(deal.id)} className="group/row cursor-pointer">
                  <th scope="row" style={{ left: INSET }} className={cx(cell, 'sticky z-10 text-left font-normal')}>
                    <button
                      type="button"
                      data-row-id={deal.id}
                      aria-current={open || undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpen(deal.id)
                      }}
                      className="-mx-1 flex w-[calc(100%+0.5rem)] min-w-0 items-center gap-2.5 rounded-md px-1 py-1 text-left focus-visible:outline-none"
                    >
                      <BrandTile name={deal.brand} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{deal.brand}</span>
                        <span className="mt-px block truncate">
                          <DealRowMeta deal={deal} />
                        </span>
                      </span>
                      <span aria-hidden className="hidden shrink-0 group-has-[[data-row-id]:focus-visible]/row:inline-flex">
                        <Kbd className="px-1.5">↵</Kbd>
                      </span>
                    </button>
                  </th>
                  <td className={cell}>
                    <ActionChip action={deal.action} />
                  </td>
                  <td className={cx(cell, 'text-right')}>
                    {fee ? (
                      <span className="block">
                        <span className="block text-[13px] font-medium tabular-nums">{fee}</span>
                        {note && <span className="block truncate text-[11px] text-subtle-foreground">{note}</span>}
                      </span>
                    ) : (
                      <Empty>{deal.terms.fee?.basis === 'gifting' ? 'Gift only' : 'No fee'}</Empty>
                    )}
                  </td>
                  <td className={cx(cell, 'text-right')}>
                    <span
                      className={cx(
                        'block text-[12.5px] whitespace-nowrap tabular-nums',
                        deal.rate.deltaInr !== null && deal.rate.deltaInr < 0 ? 'text-quiet-ink' : 'text-secondary-foreground',
                      )}
                      data-tip={deal.rate.rateInr ? `Your rate: ₹${deal.rate.rateInr.toLocaleString('en-IN')}` : 'No rate to compare'}
                    >
                      {delta ?? <Empty />}
                    </span>
                  </td>
                  <td className={cell}>
                    <span className={cx('block text-[12.5px] whitespace-nowrap', due.late ? 'text-destructive' : 'text-secondary-foreground')}>
                      {due.date}
                      {due.suffix && <span className="block text-[11px] text-subtle-foreground">{due.suffix}</span>}
                    </span>
                  </td>
                  <td className={cell}>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-secondary-foreground">
                      <span aria-hidden className={cx('size-1.5 rounded-[2px]', CATEGORY_META[deal.category].dot)} />
                      {CATEGORY_META[deal.category].short}
                    </span>
                  </td>
                  <td className={cx(cell, 'text-right')}>
                    <RiskBadge risks={deal.risks} score={deal.riskScore} className="justify-end" />
                  </td>
                  <td aria-hidden className={cell} />
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
      <p className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11.5px] text-subtle-foreground">
        <CornerDownRight aria-hidden className="size-3" />
        Latest terms win when a thread changes; drafts are never sent.
      </p>
      </div>
    </>
  )
}
