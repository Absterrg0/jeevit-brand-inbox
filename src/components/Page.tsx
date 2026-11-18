import { ChevronDown, ChevronUp, Search, SearchX, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { cx } from '../lib/cx'
import { Button, IconButton } from './ui/Button'
import { Kbd } from './ui/primitives'

/** One white working surface on the grey canvas, with the etched edge of the reference. */
export function PageSurface({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col px-2 pb-2 xl:pt-2 xl:pl-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden etched rounded-[14px] bg-background shadow-surface">{children}</div>
    </main>
  )
}

export function PageHeader({
  title,
  count,
  children,
  actions,
}: {
  title: string
  count?: number | string
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:h-14 md:flex-nowrap md:py-0">
      <h1 className="flex items-baseline gap-2 text-[16px] font-semibold tracking-[-0.02em] whitespace-nowrap">
        {title}
        {count !== undefined && <span className="text-[13px] font-normal tracking-normal text-muted-foreground tabular-nums">{count}</span>}
      </h1>
      {children && <div className="order-last flex w-full min-w-0 md:order-none md:w-auto">{children}</div>}
      <div className="ml-auto flex min-w-0 items-center gap-1.5">{actions}</div>
    </header>
  )
}

/** The row under the header: filters on the left, quiet figures on the right. */
export function PageStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex min-h-11 shrink-0 flex-wrap items-center gap-2 px-4 pb-3', className)}>{children}</div>
}

export function StripSummary({ children }: { children: ReactNode }) {
  return (
    <p className="ml-auto hidden items-center gap-3 truncate pl-3 text-xs whitespace-nowrap text-muted-foreground tabular-nums lg:flex">
      {children}
    </p>
  )
}

export function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="font-medium text-foreground">{value}</span>
      {label}
    </span>
  )
}

const track = 'flex h-8 shrink-0 items-center gap-1 rounded-[10px] bg-track p-[3px] shadow-sunk'
const segment = (active: boolean) =>
  cx(
    'inline-flex h-[26px] items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-[background-color,box-shadow,color] [&>svg]:size-3.5',
    active
      ? 'bg-thumb text-foreground shadow-raised dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]'
      : 'text-muted-foreground hover:text-foreground',
  )

export type SegmentOption<T extends string> = { id: T; label: string; icon?: ReactNode; count?: number; tip?: string }

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx(track, 'max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-tip={o.tip}
            onClick={() => onChange(o.id)}
            className={segment(active)}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined && (
              <span className={cx('text-xs tabular-nums', active ? 'text-muted-foreground' : 'text-subtle-foreground')}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Below sm a long segmented strip becomes a select, so no filter hides off-screen. */
export function MobileSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
}) {
  return (
    <label className="relative flex h-8 items-center rounded-[9px] bg-card shadow-raised sm:hidden">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-full appearance-none bg-transparent pr-7 pl-2.5 text-[12.5px] font-medium text-foreground outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.count !== undefined ? ` · ${o.count}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </label>
  )
}

/** The one signal worth chasing, as a raised key beside the filters. Amber when it means "act on this". */
export function SignalToggle({
  active,
  onToggle,
  tip,
  icon,
  children,
}: {
  active: boolean
  onToggle: () => void
  tip: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      data-tip={active ? 'Show everything' : tip}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-[box-shadow,background-color] [&>svg]:size-3.5',
        active
          ? 'bg-quiet-soft text-quiet-ink shadow-[inset_0_1px_2px_rgb(168_90_6/0.12),inset_0_0_0_1px_rgb(217_138_28/0.32)]'
          : 'bg-card text-secondary-foreground shadow-raised hover:shadow-raised-hover',
      )}
    >
      {icon}
      {children}
      {active && <X aria-hidden className="-mr-0.5 size-3" />}
    </button>
  )
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder = 'Search',
  inputRef,
  className,
}: {
  value: string
  onChange: (q: string) => void
  label: string
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
  className?: string
}) {
  return (
    <label
      className={cx(
        'flex h-8 min-w-0 items-center gap-2 rounded-[9px] bg-card pr-1.5 pl-2.5 text-muted-foreground shadow-raised transition-shadow focus-within:shadow-focus',
        className,
      )}
    >
      <Search aria-hidden className="size-3.5 shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle-foreground"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="flex size-5 items-center justify-center rounded-[6px] hover:bg-accent hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      ) : (
        <Kbd className="max-sm:hidden">/</Kbd>
      )}
    </label>
  )
}

export function NoResults({
  title,
  detail,
  onClear,
  clearLabel = 'Clear search and filters',
}: {
  title: string
  detail: string
  onClear?: () => void
  clearLabel?: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 pt-10 pb-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-raised">
        <SearchX className="size-5" />
      </span>
      <p className="mt-4 text-[14px] font-medium">{title}</p>
      <p className="mt-1 max-w-[320px] text-[13px] text-muted-foreground">{detail}</p>
      {onClear && (
        <Button className="mt-4" onClick={onClear}>
          {clearLabel}
        </Button>
      )}
    </div>
  )
}

/** Warm a search hit without changing the text's shape. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded-[3px] bg-mark px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

export function SectionHeading({ title, aside, className }: { title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-2 flex items-baseline gap-2 px-0.5', className)}>
      <h2 className="shrink-0 whitespace-nowrap text-[12.5px] font-medium text-secondary-foreground">{title}</h2>
      {aside && <span className="ml-auto min-w-0 text-right text-xs leading-4 text-subtle-foreground tabular-nums">{aside}</span>}
    </div>
  )
}

// ── Sheet ───────────────────────────────────────────────────────────────────

/**
 * A frosted bezel around a white sheet, the way the reference opens a record.
 * `depth` stacks a second sheet (an email inside a deal) above the first.
 */
export function Sheet({
  title,
  kicker,
  subtitle,
  visual,
  position,
  onPrev,
  onNext,
  onClose,
  actions,
  footer,
  wide = false,
  depth = 1,
  children,
}: {
  title: string
  kicker?: ReactNode
  subtitle?: ReactNode
  visual?: ReactNode
  position?: { index: number; total: number } | null
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  actions?: ReactNode
  footer?: ReactNode
  wide?: boolean
  depth?: 1 | 2
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [title])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      return onClose()
    }
    if (e.key === 'Tab') {
      const panel = panelRef.current
      if (!panel) return
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
      return
    }
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select')) return
    if (e.key === 'j' && onNext) {
      e.preventDefault()
      onNext()
    } else if (e.key === 'k' && onPrev) {
      e.preventDefault()
      onPrev()
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const stepButton =
    'inline-flex h-[26px] w-7 items-center justify-center text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35 [&>svg]:size-3.5'

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cx('fixed inset-0 animate-fade-in bg-canvas/45 backdrop-blur-[2px]', depth === 1 ? 'z-30' : 'z-40')}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cx(
          'fixed inset-y-0 right-0 flex w-full animate-panel-in flex-col outline-none sm:inset-y-2 sm:right-2 sm:rounded-[20px] sm:bg-bezel sm:p-[5px] sm:shadow-bezel sm:backdrop-blur-md',
          depth === 1 ? 'z-[35]' : 'z-[45]',
          wide ? 'max-w-[620px]' : 'max-w-[492px]',
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card sm:rounded-[15px] sm:shadow-[0_0_0_1px_rgb(var(--shade)/0.07)]">
          <div className="flex h-12 shrink-0 items-center gap-2.5 px-3">
            {position && (
              <>
                <span className="flex items-center overflow-hidden rounded-[9px] bg-card shadow-raised">
                  <button type="button" aria-label="Previous" disabled={!onPrev} onClick={onPrev} className={stepButton}>
                    <ChevronUp />
                  </button>
                  <span aria-hidden className="h-3.5 w-px bg-border" />
                  <button type="button" aria-label="Next" disabled={!onNext} onClick={onNext} className={stepButton}>
                    <ChevronDown />
                  </button>
                </span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {pad(position.index + 1)} / {pad(position.total)}
                </span>
              </>
            )}
            <span className="ml-auto flex items-center gap-0.5">
              {actions}
              <IconButton aria-label="Close" onClick={onClose}>
                <X />
              </IconButton>
            </span>
          </div>

          <div key={title} className="min-h-0 flex-1 animate-fade-in overflow-y-auto px-5 pt-3 pb-8" data-scrollbar>
            <div className={cx('px-1', !!visual && 'flex items-center gap-3.5')}>
              {visual}
              <div className="min-w-0">
                {kicker && (
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">{kicker}</div>
                )}
                <h2
                  ref={titleRef}
                  id={titleId}
                  tabIndex={-1}
                  className={cx(
                    'rounded font-semibold tracking-[-0.025em] focus:outline-none',
                    wide ? 'text-[24px] leading-[30px]' : 'text-[20px] leading-6',
                    !!visual && 'line-clamp-2 break-words',
                  )}
                >
                  {title}
                </h2>
                {subtitle && <div className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">{subtitle}</div>}
              </div>
            </div>
            {children}
          </div>

          {footer && <footer className="flex min-h-[60px] shrink-0 flex-wrap items-center gap-2 border-t border-border-muted px-3.5 py-2">{footer}</footer>}
        </div>
      </div>
    </>
  )
}

/** A quiet callout: recessed, with one line of heading and an explanation. */
export function Callout({
  icon,
  title,
  children,
  tone = 'neutral',
  className,
}: {
  icon?: ReactNode
  title?: ReactNode
  children: ReactNode
  tone?: 'neutral' | 'quiet' | 'danger'
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex gap-2.5 rounded-[11px] p-3 text-[12.5px] leading-[18px] shadow-sunk',
        tone === 'quiet' ? 'bg-quiet-soft text-quiet-ink' : tone === 'danger' ? 'bg-[#fdf0ee] text-destructive dark:bg-[#3a2320]' : 'bg-muted text-secondary-foreground',
        className,
      )}
    >
      {icon && <span className="mt-px shrink-0 [&>svg]:size-4">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-medium">{title}</p>}
        <div className="text-[12.5px] leading-[18px] opacity-90">{children}</div>
      </div>
    </div>
  )
}

/** For tests and quiet empty states. */
export function useSyncedState<T>(initial: T) {
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [initial])
  return [value, setValue] as const
}
