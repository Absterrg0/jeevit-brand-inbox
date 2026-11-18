import { FlaskConical, Handshake, Inbox, Moon, Scale, Sun, Sunrise } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import type { Theme } from '../state/theme'
import type { Page } from '../state/useUrlState'
import { Avatar } from './ui/primitives'

/** A funnel: the mark of a desk that winnows an inbox down to the deals worth answering. */
export function WinnowMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex size-[24px] shrink-0 items-center justify-center rounded-[8px] bg-ink text-primary-foreground shadow-ink',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[15px]" fill="none">
        <path d="M4.5 6.2h15L13.4 13v6.2l-2.9 1.4V13Z" fill="currentColor" />
      </svg>
    </span>
  )
}

export const NAV: { page: Page; label: string; short?: string; icon: typeof Sunrise }[] = [
  { page: 'today', label: 'Today', icon: Sunrise },
  { page: 'deals', label: 'Deals', icon: Handshake },
  { page: 'inbox', label: 'Inbox', icon: Inbox },
  { page: 'rules', label: 'Rules', icon: Scale },
  { page: 'evaluation', label: 'Evaluation', short: 'Eval', icon: FlaskConical },
]

const itemBase = 'flex h-[30px] w-full items-center gap-2.5 rounded-[9px] px-2 text-[13.5px]'

function NavLink({
  page,
  label,
  icon: Icon,
  active,
  count,
  onNavigate,
}: {
  page: Page
  label: string
  icon: typeof Sunrise
  active: boolean
  count?: number
  onNavigate: (page: Page) => void
}) {
  return (
    <li>
      <a
        href={page === 'today' ? '?' : `?page=${page}`}
        aria-current={active ? 'page' : undefined}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return
          e.preventDefault()
          onNavigate(page)
        }}
        className={cx(
          itemBase,
          'transition-[background-color,box-shadow,color]',
          active
            ? 'bg-card font-medium text-foreground shadow-raised'
            : 'text-secondary-foreground hover:bg-[rgb(var(--shade)/0.04)] hover:text-foreground',
        )}
      >
        <Icon aria-hidden className={cx('size-4', active ? 'text-foreground' : 'text-muted-foreground')} />
        {label}
        {count !== undefined && (
          <span className={cx('ml-auto text-xs font-normal tabular-nums', active ? 'text-muted-foreground' : 'text-subtle-foreground')}>
            {count}
          </span>
        )}
      </a>
    </li>
  )
}

export function Sidebar({
  page,
  onNavigate,
  counts,
  theme,
  onToggleTheme,
}: {
  page: Page
  onNavigate: (page: Page) => void
  counts: Partial<Record<Page, number>>
  theme: Theme
  onToggleTheme: (origin?: HTMLElement) => void
}) {
  const link = (p: Page) => {
    const meta = NAV.find((n) => n.page === p)!
    return (
      <NavLink
        key={p}
        page={p}
        label={meta.label}
        icon={meta.icon}
        active={page === p}
        count={counts[p]}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <aside className="hidden w-[232px] shrink-0 flex-col px-2.5 pt-3 pb-2.5 xl:flex">
      <a
        href="?"
        onClick={(e) => {
          e.preventDefault()
          onNavigate('today')
        }}
        className={cx(itemBase, 'gap-2.5 font-semibold text-foreground')}
      >
        <WinnowMark />
        <span className="flex min-w-0 flex-col leading-none">
          Winnow
          <span className="mt-1 text-[10.5px] font-normal tracking-[0.01em] text-subtle-foreground">brand deal desk</span>
        </span>
      </a>

      <nav aria-label="Workspace" className="mt-6 flex-1">
        <p className="px-2 pb-1.5 text-xs font-medium text-subtle-foreground">Desk</p>
        <ul className="space-y-0.5">
          {link('today')}
          {link('deals')}
          {link('inbox')}
        </ul>

        <p className="px-2 pt-5 pb-1.5 text-xs font-medium text-subtle-foreground">Reference</p>
        <ul className="space-y-0.5">
          {link('rules')}
          {link('evaluation')}
        </ul>
      </nav>

      <div className="mb-2 rounded-[10px] bg-[rgb(var(--shade)/0.035)] px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-secondary-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-label-green" />
          Drafts only
        </span>
        Nothing leaves this desk until you review and send it yourself.
      </div>

      <div className="flex h-10 items-center gap-2.5 px-1.5">
        <Avatar />
        <span className="mr-auto flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-medium">Riya Menon</span>
          <span className="text-[10.5px] text-subtle-foreground">@riya.creates</span>
        </span>
        <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
      </div>
    </aside>
  )
}

/** Below xl the sidebar becomes a bar across the top: the same nav, one scrollable row. */
export function MobileBar({
  page,
  onNavigate,
  theme,
  onToggleTheme,
}: {
  page: Page
  onNavigate: (page: Page) => void
  theme: Theme
  onToggleTheme: (origin?: HTMLElement) => void
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1 px-3 pt-2.5 pb-1 xl:hidden">
      <div className="flex items-center gap-2.5">
        <a
          href="?"
          onClick={(e) => {
            e.preventDefault()
            onNavigate('today')
          }}
          className="flex items-center gap-2 font-semibold"
        >
          <WinnowMark />
          Winnow
        </a>
        <span className="text-[11px] text-subtle-foreground">brand deal desk</span>
        <span className="ml-auto flex items-center gap-2">
          <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
        </span>
      </div>
      <nav aria-label="Workspace" className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex items-center gap-1 pb-1">
          {NAV.map((item) => {
            const active = item.page === page
            return (
              <li key={item.page}>
                <a
                  href={item.page === 'today' ? '?' : `?page=${item.page}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) return
                    e.preventDefault()
                    onNavigate(item.page)
                  }}
                  className={cx(
                    'inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] whitespace-nowrap transition-[background-color,box-shadow]',
                    active ? 'bg-card font-medium text-foreground shadow-raised' : 'text-muted-foreground',
                  )}
                >
                  <item.icon aria-hidden className="hidden size-3.5 sm:block" />
                  {item.short ?? item.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

/** A recessed track with a raised thumb that carries the current mode's icon. */
export function ThemeSwitch({ theme, onToggle }: { theme: Theme; onToggle: (origin?: HTMLElement) => void }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={(event) => onToggle(event.currentTarget)}
      className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full bg-track p-[2px] shadow-sunk"
    >
      <span
        aria-hidden
        className={cx(
          'relative flex size-[18px] items-center justify-center rounded-full bg-thumb text-foreground shadow-raised transition-transform duration-500 ease-[cubic-bezier(0.55,0,0.25,1)]',
          dark && 'translate-x-4',
        )}
      >
        <Sun
          className={cx(
            'absolute size-[11px] transition-[opacity,rotate,scale] duration-500 ease-[cubic-bezier(0.55,0,0.25,1)]',
            dark ? 'scale-50 -rotate-90 opacity-0' : 'opacity-100',
          )}
        />
        <Moon
          className={cx(
            'absolute size-[11px] transition-[opacity,rotate,scale] duration-500 ease-[cubic-bezier(0.55,0,0.25,1)]',
            dark ? 'opacity-100' : 'scale-50 rotate-90 opacity-0',
          )}
        />
      </span>
    </button>
  )
}

export function FooterNote({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-4 text-subtle-foreground">{children}</p>
}
