import { Ban, Check, ChevronDown, Copy, IndianRupee, Mail, Moon, Reply, ShieldAlert, Sparkles, Sun, Wheat, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import profile from '../data/creator_profile.json'
import raw from '../out/analysis.json'
import type { Action, Analysis, Deal, Severity } from '../src/types'
import { cx, dueText, inr, money, offerText, scopeText, shortDate, useTheme } from './lib'

// The UI renders exactly what `npm run analyze` wrote. It runs no logic of its own.
const analysis = raw as unknown as Analysis

const ACTION_WORD: Record<Action, string> = {
  accept: 'Accept',
  negotiate: 'Negotiate',
  ask_for_details: 'Ask for details',
  review_manually: 'Read it yourself',
  decline: 'Decline',
  report: 'Report',
  ignore: 'Ignore',
}

interface Tone {
  dot: string
  pill: string
  bar: string
  tint: string
  icon: string
}
const GREEN: Tone = { dot: 'bg-label-green', pill: 'bg-label-green/12 text-label-green', bar: 'bg-label-green', tint: 'bg-label-green/[0.07]', icon: 'bg-label-green/12 text-label-green' }
const AMBER: Tone = { dot: 'bg-quiet', pill: 'bg-quiet-soft text-quiet-ink', bar: 'bg-quiet', tint: 'bg-quiet/[0.08]', icon: 'bg-quiet-soft text-quiet-ink' }
const RED: Tone = { dot: 'bg-label-red', pill: 'bg-label-red/12 text-label-red', bar: 'bg-label-red', tint: 'bg-label-red/[0.07]', icon: 'bg-label-red/12 text-label-red' }
const GREY: Tone = { dot: 'bg-subtle-foreground', pill: 'bg-accent text-muted-foreground', bar: 'bg-subtle-foreground', tint: 'bg-muted', icon: 'bg-accent text-muted-foreground' }
const BLUE_ICON = 'bg-label-blue/12 text-label-blue'

const SECTIONS: { title: string; actions: Action[]; tone: Tone }[] = [
  { title: 'Reply to these', actions: ['accept', 'negotiate', 'ask_for_details', 'review_manually'], tone: GREEN },
  { title: 'Decline politely', actions: ['decline'], tone: AMBER },
  { title: 'Scams — report', actions: ['report'], tone: RED },
  { title: 'Nothing to do', actions: ['ignore'], tone: GREY },
]

const SEVERITY_DOT: Record<Severity, string> = { high: 'bg-label-red', medium: 'bg-quiet', low: 'bg-subtle-foreground' }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const inSection = (i: number) => analysis.deals.filter((d) => SECTIONS[i].actions.includes(d.action))
const toneOf = (deal: Deal) => SECTIONS.find((s) => s.actions.includes(deal.action))!.tone

const GROUPS = SECTIONS.map((s, i) => ({ ...s, deals: inSection(i) })).filter((g) => g.deals.length)
const ORDER = GROUPS.flatMap((g) => g.deals)
const replies = inSection(0)
const declines = inSection(1)
const scams = inSection(2)
const onOffer = replies.reduce((sum, d) => sum + (d.terms.fee?.inr ?? 0), 0)

function brief(): string {
  const parts = [replies.length ? `${plural(replies.length, 'deal needs', 'deals need')} a reply from you` : 'No deals need a reply today']
  if (declines.length) parts.push(`${plural(declines.length, 'is', 'are')} worth a polite no`)
  if (scams.length) parts.push(`${plural(scams.length, 'is a scam', 'are scams')} — don’t open the links`)
  return `${parts.join(', ')}.`
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
function creatorLine(): string {
  const p = (profile as { platforms?: { instagram?: { handle: string; followers: number }; youtube?: { channel: string; subscribers: number } } }).platforms
  const parts: string[] = []
  if (p?.instagram) parts.push(`${p.instagram.handle} · ${compact(p.instagram.followers)} on Instagram`)
  if (p?.youtube) parts.push(`${compact(p.youtube.subscribers)} on YouTube`)
  return parts.join(' · ')
}

/** A scam's "fee" is bait, not an offer, so only real outreach gets its terms shown. */
const isReal = (deal: Deal) => deal.category !== 'scam_or_phishing' && deal.category !== 'spam'

function nextStep(deal: Deal): string {
  switch (deal.action) {
    case 'accept':
      return 'Say yes — the draft below confirms the terms.'
    case 'negotiate':
      return deal.counter ? `Counter at ${money(deal.counter.amount, deal.counter.currency)} — the draft below asks for it.` : 'Push back on the terms — the draft below does it.'
    case 'ask_for_details':
      return 'Ask for the missing details before you commit — the draft below does it.'
    case 'review_manually':
      return 'Read this one yourself before replying.'
    case 'decline':
      return 'Decline politely — the draft below keeps the door open.'
    case 'report':
      return 'Don’t reply, pay or click. Report as phishing.'
    case 'ignore':
      return 'Nothing to do. Archive it.'
  }
}

function termCells(deal: Deal): { label: string; value: string; note?: string; noteClass?: string }[] {
  const t = deal.terms
  const due = dueText(analysis.today, deal)
  const gap = deal.rate?.gapPct
  return [
    { label: 'Offer', value: offerText(t), note: t.fee && t.fee.currency !== 'INR' ? `≈ ${inr(t.fee.inr)}` : undefined },
    {
      label: 'Your rate',
      value: deal.rate ? inr(deal.rate.rateCardInr) : '—',
      note: gap == null ? undefined : gap === 0 ? 'offer matches it' : `offer is ${Math.abs(gap)}% ${gap < 0 ? 'below' : 'above'}`,
      noteClass: gap == null ? undefined : gap < 0 ? 'text-label-red' : 'text-label-green',
    },
    { label: 'Counter', value: deal.counter ? money(deal.counter.amount, deal.counter.currency) : '—', note: deal.counter ? 'suggested ask' : undefined },
    { label: 'Deliverables', value: scopeText(t) ?? 'Not stated', note: t.product ?? undefined },
    { label: 'Go-live', value: due?.text ?? 'Not stated', noteClass: 'text-quiet-ink', note: due?.urgent ? 'needs attention' : undefined },
    {
      label: 'Usage',
      value: t.usage ? (t.usage.perpetual ? 'Forever' : t.usage.months ? plural(t.usage.months, 'month', 'months') : 'Stated') : 'Not stated',
      note: t.usage ? [t.usage.paidAds && 'paid ads', t.usage.whitelisting && 'whitelisting'].filter(Boolean).join(' · ') || undefined : undefined,
    },
  ]
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers and non-secure pages: copy through a hidden textarea.
    const area = document.createElement('textarea')
    area.value = text
    area.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      /* nothing else to try */
    }
    area.remove()
    return ok
  }
}

function useDesktop(): boolean {
  const query = '(min-width: 1024px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

const label = 'text-[11px] font-semibold tracking-[0.07em] text-muted-foreground uppercase'

function Pill({ deal }: { deal: Deal }) {
  return <span className={cx('inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap', toneOf(deal).pill)}>{ACTION_WORD[deal.action]}</span>
}

function Detail({ deal, inline = false }: { deal: Deal; inline?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [showEmails, setShowEmails] = useState(false)
  const tone = toneOf(deal)
  const real = isReal(deal)
  const scam = deal.action === 'report'
  const emails = analysis.emails.filter((e) => deal.emailIds.includes(e.id))
  const reasons = deal.flags.length
    ? deal.flags.map((f) => ({ title: f.title, text: f.reason, evidence: f.evidence, dot: SEVERITY_DOT[f.severity] }))
    : [{ title: '', text: deal.why, evidence: undefined, dot: SEVERITY_DOT.low }]
  const hasMoney = real && (deal.terms.fee || deal.terms.giftValue)
  const copy = async () => {
    if (!(await copyText(deal.draft!.body))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className={cx('flex flex-col', inline ? 'gap-6 px-4 pt-2 pb-6' : 'gap-8 px-8 pt-7 pb-10 xl:px-10')}>
      {!inline && (
        <header className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">{deal.brand}</h2>
              <Pill deal={deal} />
            </div>
            <p className="mt-1.5 truncate text-[13px] text-muted-foreground">
              {deal.contact.name ? `${deal.contact.name} · ` : ''}
              {deal.contact.email} · {plural(deal.emailIds.length, 'email', 'emails')}
            </p>
          </div>
          {hasMoney && (
            <div className="shrink-0 text-right">
              <p className="text-[26px] leading-tight font-semibold tracking-[-0.03em] tabular-nums">{offerText(deal.terms)}</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">offered</p>
            </div>
          )}
        </header>
      )}

      <div className={cx('flex gap-3.5 rounded-[14px] p-4', tone.tint, scam && 'ring-1 ring-label-red/25')}>
        <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-[10px]', tone.icon)}>{scam ? <ShieldAlert aria-hidden className="size-4" /> : <Sparkles aria-hidden className="size-4" />}</span>
        <div className="min-w-0">
          <p className={cx(label, scam && 'text-label-red')}>{scam ? 'Scam — do not engage' : 'Recommended next step'}</p>
          <p className="mt-1 text-[15px] leading-snug font-semibold tracking-[-0.01em]">{nextStep(deal)}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-secondary-foreground">{deal.why}</p>
        </div>
      </div>

      {real && (
        <section>
          <h3 className={label}>Terms</h3>
          <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-border-muted shadow-raised sm:grid-cols-3">
            {termCells(deal).map((c) => (
              <div key={c.label} className="min-w-0 bg-card px-4 py-3.5">
                <dt className="text-[12px] text-muted-foreground">{c.label}</dt>
                <dd className="mt-1 text-[15.5px] leading-snug font-semibold tracking-[-0.01em] break-words tabular-nums">{c.value}</dd>
                {c.note && <dd className={cx('mt-0.5 truncate text-[12px] tabular-nums', c.noteClass ?? 'text-muted-foreground')}>{c.note}</dd>}
              </div>
            ))}
          </dl>
        </section>
      )}

      <section>
        <h3 className={label}>Why</h3>
        <ul className="mt-3 flex flex-col gap-3.5">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className={cx('mt-[7px] size-2 shrink-0 rounded-full', r.dot)} />
              <div className="min-w-0">
                {r.title && <p className="text-[14px] font-semibold tracking-[-0.005em]">{r.title}</p>}
                <p className="text-[13.5px] leading-relaxed text-secondary-foreground">{r.text}</p>
                {r.evidence && <blockquote className="mt-1.5 border-l-2 border-border pl-3 text-[13px] leading-relaxed break-words text-muted-foreground italic">“{r.evidence}”</blockquote>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {deal.draft && (
        <section>
          <h3 className={label}>Draft reply</h3>
          <div className="mt-3 overflow-hidden rounded-[14px] bg-card shadow-raised">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-border-muted px-5 py-3.5 text-[13px]">
              <span className="text-muted-foreground">To</span>
              <span className="truncate text-secondary-foreground">{deal.contact.email}</span>
              <span className="text-muted-foreground">Subject</span>
              <span className="truncate font-medium">{deal.draft.subject}</span>
            </div>
            <p className={cx('px-5 py-4 leading-[1.7] break-words whitespace-pre-wrap', inline ? 'text-[14px]' : 'max-w-[72ch] text-[14.5px]')}>{deal.draft.body}</p>
            <div className="flex items-center justify-between gap-3 border-t border-border-muted bg-muted px-5 py-3">
              <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Mail aria-hidden className="size-3.5" />
                Nothing is sent
              </span>
              <button
                type="button"
                onClick={copy}
                className={cx(
                  'inline-flex h-9 min-w-[128px] shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 text-[13.5px] font-medium transition-all duration-150 active:translate-y-px',
                  copied ? 'bg-label-green text-white' : 'bg-ink text-primary-foreground shadow-ink hover:bg-ink-hover',
                )}
              >
                {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                <span aria-live="polite">{copied ? 'Copied ✓' : 'Copy reply'}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      <section>
        <button
          type="button"
          onClick={() => setShowEmails(!showEmails)}
          aria-expanded={showEmails}
          className="flex w-full items-center justify-between rounded-[12px] bg-muted px-4 py-3 text-[13.5px] font-medium text-secondary-foreground shadow-sunk transition-colors hover:bg-accent"
        >
          <span>
            Original {emails.length === 1 ? 'email' : 'emails'} <span className="font-normal text-muted-foreground tabular-nums">· {emails.length}</span>
          </span>
          <ChevronDown aria-hidden className={cx('size-4 text-muted-foreground transition-transform duration-200', showEmails && 'rotate-180')} />
        </button>
        {showEmails && (
          <ul className="mt-3 flex animate-fade-in flex-col gap-3">
            {emails.map((e) => (
              <li key={e.id} className="min-w-0 rounded-[12px] bg-card px-4 py-3.5 shadow-raised">
                <p className="text-[13.5px] font-medium break-words">{e.subject}</p>
                <p className="mt-0.5 text-[12px] break-all text-muted-foreground">
                  {e.from} · {shortDate(e.receivedAt)}
                </p>
                <p className="mt-2.5 max-w-[80ch] text-[13px] leading-relaxed break-words whitespace-pre-wrap text-secondary-foreground">{e.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Row({ deal, selected, inline, onSelect }: { deal: Deal; selected: boolean; inline: boolean; onSelect: () => void }) {
  const tone = toneOf(deal)
  const real = isReal(deal)
  const hasMoney = real && (deal.terms.fee || deal.terms.giftValue)
  return (
    <li id={deal.id} className="relative">
      <span aria-hidden className={cx('absolute inset-y-0 left-0 z-10 w-[3px] transition-opacity duration-200', tone.bar, selected ? 'opacity-100' : 'opacity-0')} />
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={inline ? selected : undefined}
        aria-current={!inline && selected ? 'true' : undefined}
        className={cx('block w-full px-5 py-3.5 text-left transition-colors duration-150 focus-visible:-outline-offset-2', selected ? tone.tint : 'hover:bg-muted active:bg-accent')}
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="min-w-0 truncate text-[14.5px] font-semibold tracking-[-0.01em]">{deal.brand}</span>
          {hasMoney && <span className="shrink-0 text-[14.5px] font-semibold tracking-[-0.01em] tabular-nums">{offerText(deal.terms)}</span>}
        </span>
        <span className="mt-1.5 flex items-center gap-2.5">
          <Pill deal={deal} />
          <span className="min-w-0 truncate text-[13px] text-muted-foreground">{deal.why}</span>
        </span>
      </button>
      {inline && (
        <div inert={!selected} className={cx('grid transition-[grid-template-rows,opacity] duration-300 ease-out', selected ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
          <div className="min-h-0 overflow-hidden">{selected && <Detail deal={deal} inline />}</div>
        </div>
      )}
    </li>
  )
}

function Stat({ icon: Icon, tone, value, text }: { icon: LucideIcon; tone: string; value: string; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-[14px] bg-card px-4 py-3.5 shadow-raised lg:min-w-[178px] lg:px-5 lg:py-4">
      <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-[10px]', tone)}>
        <Icon aria-hidden className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[21px] leading-none font-semibold tracking-[-0.025em] tabular-nums lg:text-[24px]">{value}</p>
        <p className="mt-1.5 truncate text-[12.5px] text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

export function App() {
  const { dark, toggle } = useTheme()
  const desktop = useDesktop()
  // A link like #D-01 opens that deal.
  const [picked, setPicked] = useState<string | null>(() => window.location.hash.slice(1) || null)
  const selectedId = desktop ? (picked ?? ORDER[0]?.id ?? null) : picked
  const selected = ORDER.find((d) => d.id === selectedId) ?? null
  const firstName = analysis.generatedFor.split(' ')[0]
  const creator = creatorLine()

  useEffect(() => {
    if (!desktop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const i = ORDER.findIndex((d) => d.id === selectedId)
      const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (!next) return
      e.preventDefault()
      setPicked(next.id)
      const button = document.getElementById(next.id)?.querySelector('button')
      button?.focus({ preventScroll: true })
      button?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desktop, selectedId])

  const list = GROUPS.map((g) => (
    <section key={g.title} className={cx(!desktop && 'mt-7')}>
      <h2
        className={cx(
          'flex items-center gap-2 text-[12.5px] font-semibold tracking-[-0.005em]',
          desktop ? 'sticky top-0 z-20 border-y border-border-muted bg-muted/90 px-5 py-2 backdrop-blur-md first:border-t-0' : 'px-1 pb-2.5 text-[13.5px]',
        )}
      >
        <span aria-hidden className={cx('size-2 rounded-full', g.tone.dot)} />
        {g.title}
        <span className="ml-auto rounded-full bg-accent px-2 py-px text-[11.5px] font-medium text-muted-foreground tabular-nums">{g.deals.length}</span>
      </h2>
      <ul className={cx('divide-y divide-border-muted', !desktop && 'overflow-hidden rounded-[14px] bg-card shadow-raised')}>
        {g.deals.map((d) => (
          <Row key={d.id} deal={d} inline={!desktop} selected={selectedId === d.id} onSelect={() => setPicked(desktop ? d.id : selectedId === d.id ? null : d.id)} />
        ))}
      </ul>
    </section>
  ))

  return (
    <div data-scrollbar className="h-full overflow-y-auto lg:overflow-hidden">
      <div className="mx-auto flex min-h-full max-w-[1440px] flex-col px-4 lg:h-full lg:px-8">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border lg:h-[60px] lg:gap-4">
          <span className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-[9px] bg-ink text-primary-foreground shadow-ink">
              <Wheat aria-hidden className="size-4" />
            </span>
            <span className="text-[15.5px] font-semibold tracking-[-0.02em]">Winnow</span>
          </span>
          <span aria-hidden className="h-5 w-px bg-border" />
          <span className="min-w-0 truncate text-[13.5px]">
            <span className="font-medium">{analysis.generatedFor}</span>
            {creator && <span className="hidden text-muted-foreground md:inline"> · {creator}</span>}
          </span>
          <span className="ml-auto hidden text-[13px] text-muted-foreground tabular-nums sm:inline">{shortDate(analysis.today, true)}</span>
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-card text-secondary-foreground shadow-raised transition-shadow hover:shadow-raised-hover active:translate-y-px sm:ml-0"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </header>

        <div className="flex shrink-0 flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:py-7">
          <div className="min-w-0">
            <p className="text-[12.5px] text-muted-foreground sm:hidden">{shortDate(analysis.today, true)}</p>
            <h1 className="text-[28px] leading-[1.12] font-semibold tracking-[-0.035em] lg:text-[36px]">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-secondary-foreground lg:text-[15.5px]">{brief()}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={IndianRupee} tone={BLUE_ICON} value={inr(onOffer)} text="in real offers" />
            <Stat icon={Reply} tone={GREEN.icon} value={String(replies.length)} text={replies.length === 1 ? 'Reply to send' : 'Replies to send'} />
            <Stat icon={Ban} tone={AMBER.icon} value={String(declines.length)} text="Decline" />
            <Stat icon={ShieldAlert} tone={RED.icon} value={String(scams.length)} text={scams.length === 1 ? 'Scam to report' : 'Scams to report'} />
          </div>
        </div>

        {desktop ? (
          <main className="flex min-h-0 flex-1 gap-5">
            <nav aria-label="Deals" data-scrollbar className="w-[420px] shrink-0 overflow-y-auto rounded-[16px] bg-card shadow-raised">
              {list}
            </nav>
            <article data-scrollbar key={selected?.id} className="min-w-0 flex-1 animate-fade-in overflow-y-auto rounded-[16px] bg-background shadow-raised">
              {selected && <Detail deal={selected} />}
            </article>
          </main>
        ) : (
          <main className="-mt-2">{list}</main>
        )}

        <p className="shrink-0 py-4 text-center text-[12px] leading-relaxed text-subtle-foreground max-lg:mt-8 max-lg:pb-10">A model reads each email; code checks the quotes, does the maths and decides. Nothing is sent.</p>
      </div>
    </div>
  )
}
