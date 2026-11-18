import type { Action, Deal } from '../engine/types'
import { deliverableText } from '../engine/assess'
import { cx } from '../lib/cx'
import { money, whenLabel } from '../lib/format'
import { CATEGORY_META } from '../lib/meta'
import { BrandTile, RiskBadge } from './ui/primitives'

const LANES: { key: string; label: string; actions: Action[] }[] = [
  { key: 'negotiate', label: 'Negotiate', actions: ['negotiate'] },
  { key: 'ask', label: 'Ask for details', actions: ['ask_for_details'] },
  { key: 'accept', label: 'Accept', actions: ['accept'] },
  { key: 'decline', label: 'Decline', actions: ['decline'] },
  { key: 'report', label: 'Report or ignore', actions: ['report', 'ignore'] },
]

const LANE_TONE: Record<Action, string> = {
  negotiate: 'bg-label-blue',
  ask_for_details: 'bg-quiet',
  accept: 'bg-label-green',
  decline: 'bg-label-violet',
  report: 'bg-label-red',
  ignore: 'bg-subtle-foreground',
}

export function DealsBoard({
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
  return (
    <div className="h-full overflow-auto overscroll-contain px-3 pt-1 pb-3" data-scrollbar>
      <div className="flex h-full min-h-0 gap-2.5">
        {LANES.map((lane) => {
          const rows = deals.filter((d) => lane.actions.includes(d.action)).sort((a, b) => b.priority - a.priority)
          return (
            <section key={lane.key} aria-label={`${lane.label}: ${rows.length}`} className="flex min-w-[220px] flex-1 flex-col">
              <header className="flex h-9 shrink-0 items-center gap-2 px-2.5">
                <span aria-hidden className={cx('size-1.5 rounded-full', LANE_TONE[lane.actions[0]])} />
                <h2 className="text-[12.5px] font-medium">{lane.label}</h2>
                <span className="ml-auto text-xs text-subtle-foreground tabular-nums">{rows.length}</span>
              </header>
              <ul className="-mx-0.5 min-h-0 flex-1 space-y-2 overflow-y-auto px-0.5 pb-3">
                {rows.length === 0 && (
                  <li className="mx-0.5 flex flex-col items-center rounded-[11px] border border-dashed border-border px-4 py-7 text-center">
                    <p className="text-[12px] text-subtle-foreground">Nothing here</p>
                  </li>
                )}
                {rows.map((deal) => (
                  <li key={deal.id}>
                    <DealCard deal={deal} today={today} open={openId === deal.id} onOpen={() => onOpen(deal.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function DealCard({ deal, today, open, onOpen }: { deal: Deal; today: string; open: boolean; onOpen: () => void }) {
  const due = whenLabel(deal, today)
  const fee = money(deal.terms.fee)
  const deliverables = deal.terms.deliverables.length ? deliverableText(deal.terms.deliverables) : null

  return (
    <article
      className={cx(
        'group/card relative rounded-[12px] bg-card transition-[box-shadow] duration-150',
        open
          ? 'shadow-[0_0_0_1.5px_rgb(var(--shade)/0.32),0_2px_6px_-2px_rgb(0_0_0/0.12)]'
          : 'shadow-raised hover:shadow-raised-hover',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${deal.brand}`}
        className="block w-full rounded-[12px] p-3 text-left after:absolute after:inset-0 after:rounded-[12px] focus-visible:outline-none focus-visible:after:shadow-[0_0_0_1px_rgb(var(--shade)/0.26),0_0_0_4px_rgb(var(--shade)/0.06)]"
      >
        <div className="flex items-start gap-2.5">
          <BrandTile name={deal.brand} size="sm" className="mt-px" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-5 font-medium">{deal.brand}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{deliverables ?? 'Scope not stated'}</p>
          </div>
          {fee && <span className="shrink-0 text-[12px] font-medium tabular-nums">{fee}</span>}
        </div>

        <p className="mt-2 line-clamp-2 text-[12px] leading-[17px] text-secondary-foreground">{deal.summary}</p>

        <div className="mt-2.5 flex items-center gap-2 border-t border-border-muted pt-2 text-[11px] text-subtle-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span aria-hidden className={cx('size-1.5 shrink-0 rounded-[2px]', CATEGORY_META[deal.category].dot)} />
            <span className="truncate">{CATEGORY_META[deal.category].short}</span>
          </span>
          {deal.terms.deadline.date && <span className={cx('shrink-0', due.late && 'text-destructive')}>{due.date}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <RiskBadge risks={deal.risks} score={deal.riskScore} />
          </span>
        </div>
      </button>
    </article>
  )
}
