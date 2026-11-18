import type { ReactNode } from 'react'
import type { Action, Category, Deal, RiskFlag } from '../../engine/types'
import { cx } from '../../lib/cx'
import { ACTION_META, CATEGORY_META, SEVERITY_META, riskTone } from '../../lib/meta'

/** A monochrome mark for a brand, picked from its name, so no real logo is borrowed. */
const TILE_SIZES = {
  sm: 'size-6 rounded-[7px]',
  md: 'size-8 rounded-[9px]',
  lg: 'size-10 rounded-[11px]',
  xl: 'size-12 rounded-[13px]',
} as const

const INKS = ['#22262b', '#3d4a57', '#6b4b3e', '#4d5c44', '#4e4670', '#7a5f2c', '#38585e']

export function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

export function BrandTile({ name, size = 'md', className }: { name: string; size?: keyof typeof TILE_SIZES; className?: string }) {
  const h = hash(name)
  const shape = h % 7
  const marks = [
    <circle key="0" cx="12" cy="12" r="5.4" fill="white" />,
    <path key="1" d="M6.6 15.4 12 6.2l5.4 9.2Z" fill="white" />,
    <path key="2" d="M6.6 12a5.4 5.4 0 0 1 10.8 0Z M6.6 13.4h10.8v2.1H6.6Z" fill="white" />,
    <path key="3" d="M7 7h4v10H7Z M13 10.4h4V17h-4Z" fill="white" />,
    <path key="4" d="M12 6.4 17.6 12 12 17.6 6.4 12Z" fill="white" />,
    <circle key="5" cx="12" cy="12" r="4.5" fill="none" stroke="white" strokeWidth="2.3" />,
    <path key="6" d="M7 17V7a10 10 0 0 1 10 10Z" fill="white" />,
  ]
  return (
    <span
      aria-hidden
      style={{ backgroundColor: INKS[h % INKS.length] }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_0_0_1px_rgb(var(--shade)/0.12)]',
        TILE_SIZES[size],
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[76%]">
        {marks[shape]}
      </svg>
    </span>
  )
}

export function CategoryChip({ category, className, short = false }: { category: Category; className?: string; short?: boolean }) {
  const meta = CATEGORY_META[category]
  return (
    <span
      title={meta.hint}
      className={cx(
        'inline-flex h-[22px] items-center gap-1.5 rounded-[7px] bg-muted px-2 text-[12px] whitespace-nowrap text-secondary-foreground shadow-sunk',
        className,
      )}
    >
      <span aria-hidden className={cx('size-1.5 shrink-0 rounded-[2px]', meta.dot)} />
      {short ? meta.short : meta.label}
    </span>
  )
}

export function ActionChip({ action, className, raised = false }: { action: Action; className?: string; raised?: boolean }) {
  const { label, icon: Icon } = ACTION_META[action]
  return (
    <span
      className={cx(
        'inline-flex h-[26px] items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] font-medium whitespace-nowrap',
        raised ? 'bg-card text-foreground shadow-raised' : 'text-secondary-foreground',
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 text-muted-foreground" />
      {label}
    </span>
  )
}

export function RiskBadge({ risks, score, className }: { risks: RiskFlag[]; score: number; className?: string }) {
  if (!risks.length) return <span className={cx('text-[12.5px] text-subtle-foreground', className)}>None</span>
  const tone = riskTone(score)
  const meta = SEVERITY_META[tone === 'none' ? 'low' : tone]
  return (
    <span
      title={risks.map((r) => `${r.title}: ${r.why}`).join('\n\n')}
      className={cx('inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap', meta.text, className)}
    >
      <span aria-hidden className={cx('size-1.5 rounded-full', meta.dot)} />
      <span className="tabular-nums">{risks.length}</span>
      <span className="text-muted-foreground">{risks.length === 1 ? 'flag' : 'flags'}</span>
    </span>
  )
}

export function Kbd({ children, onDark = false, className }: { children: ReactNode; onDark?: boolean; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 font-sans text-[10.5px] leading-none font-medium',
        onDark
          ? 'bg-current/10 opacity-80 shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_14%,transparent)]'
          : 'bg-card text-muted-foreground shadow-key',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Empty({ children = 'Not stated' }: { children?: ReactNode }) {
  return <span className="text-subtle-foreground">{children}</span>
}

export function Meter({ value, className, tone = 'ink' }: { value: number; className?: string; tone?: 'ink' | 'muted' | 'quiet' }) {
  return (
    <span aria-hidden className={cx('relative block h-1.5 overflow-hidden rounded-full bg-accent shadow-sunk', className)}>
      <span
        className={cx(
          'absolute inset-y-0 left-0 rounded-full',
          tone === 'ink' ? 'bg-foreground/80' : tone === 'quiet' ? 'bg-quiet' : 'bg-subtle-foreground',
        )}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </span>
  )
}

export function Avatar({ initials = 'RM', className }: { initials?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e6e0d6] text-[9.5px] font-semibold text-[#5c4f3d] shadow-[inset_0_0_0_1px_rgb(var(--shade)/0.08)] dark:brightness-90',
        className,
      )}
    >
      {initials}
    </span>
  )
}

/** Small quiet figure: value in ink, label muted. */
export function Figure({ value, label, className }: { value: ReactNode; label: string; className?: string }) {
  return (
    <span className={cx('flex flex-col gap-0.5', className)}>
      <span className="text-[17px] leading-6 font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
    </span>
  )
}

/** A key/value pair in the sheet and on the rules page. */
export function Property({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-w-0 items-baseline gap-3 py-[7px]', className)}>
      <dt className="w-[92px] shrink-0 text-[12px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-[12.5px] text-secondary-foreground">{children}</dd>
    </div>
  )
}

export function DealRowMeta({ deal }: { deal: Pick<Deal, 'emails' | 'terms'> }) {
  const count = deal.terms.deliverables.reduce((n, d) => n + d.qty, 0)
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {count ? `${count} ${count === 1 ? 'deliverable' : 'deliverables'}` : 'No deliverables'}
      <span aria-hidden className="size-0.5 rounded-full bg-subtle-foreground" />
      {deal.emails.length === 1 ? '1 email' : `${deal.emails.length} emails`}
    </span>
  )
}
