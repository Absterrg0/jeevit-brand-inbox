import { Check, Copy, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
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
}
const GREEN: Tone = { dot: 'bg-label-green', pill: 'bg-label-green/10 text-label-green', bar: 'bg-label-green' }
const AMBER: Tone = { dot: 'bg-quiet', pill: 'bg-quiet-soft text-quiet-ink', bar: 'bg-quiet' }
const RED: Tone = { dot: 'bg-label-red', pill: 'bg-label-red/10 text-label-red', bar: 'bg-label-red' }
const GREY: Tone = { dot: 'bg-subtle-foreground', pill: 'bg-muted text-muted-foreground', bar: 'bg-subtle-foreground' }

const SECTIONS: { title: string; actions: Action[]; tone: Tone }[] = [
  { title: 'Reply to these', actions: ['accept', 'negotiate', 'ask_for_details', 'review_manually'], tone: GREEN },
  { title: 'Decline politely', actions: ['decline'], tone: AMBER },
  { title: 'Scams — report, don’t reply', actions: ['report'], tone: RED },
  { title: 'Nothing to do', actions: ['ignore'], tone: GREY },
]

const SEVERITY_DOT: Record<Severity, string> = { high: 'bg-label-red', medium: 'bg-quiet', low: 'bg-subtle-foreground' }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const inSection = (i: number) => analysis.deals.filter((d) => SECTIONS[i].actions.includes(d.action))

const replies = inSection(0)
const scamEmails = inSection(2).reduce((sum, d) => sum + d.emailIds.length, 0)
const onOffer = replies.reduce((sum, d) => sum + (d.terms.fee?.inr ?? 0), 0)

function summary(): string {
  const parts = [replies.length ? `${plural(replies.length, 'deal needs', 'deals need')} a reply.` : 'No deals need a reply today.']
  if (scamEmails) parts.push(plural(scamEmails, 'email is a scam — don’t open its links.', 'emails are scams — don’t open their links.'))
  return parts.join(' ')
}

/** A scam's "fee" is bait, not an offer, so only real outreach gets its terms shown. */
const isReal = (deal: Deal) => deal.category !== 'scam_or_phishing' && deal.category !== 'spam'

function termsLine(deal: Deal): string {
  const t = deal.terms
  const parts: string[] = []
  if (t.fee || t.giftValue || t.paymentType === 'gifting') parts.push(`Offer ${offerText(t)}`)
  if (deal.rate) parts.push(`your rate ${inr(deal.rate.rateCardInr)}`)
  if (deal.counter) parts.push(`counter ${money(deal.counter.amount, deal.counter.currency)}`)
  if (t.usage) parts.push(`usage ${t.usage.perpetual ? 'forever' : t.usage.months ? plural(t.usage.months, 'month', 'months') : 'stated'}`)
  return parts.join(' · ')
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

const label = 'text-[11.5px] font-medium tracking-[0.04em] text-muted-foreground uppercase'

function Details({ deal }: { deal: Deal }) {
  const [copied, setCopied] = useState(false)
  const [showEmails, setShowEmails] = useState(false)
  const emails = analysis.emails.filter((e) => deal.emailIds.includes(e.id))
  const reasons = deal.flags.length ? deal.flags.slice(0, 3).map((f) => ({ text: f.reason, dot: SEVERITY_DOT[f.severity] })) : [{ text: deal.why, dot: SEVERITY_DOT.low }]
  const terms = isReal(deal) ? termsLine(deal) : ''
  const copy = async () => {
    if (!(await copyText(deal.draft!.body))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="flex flex-col gap-5 px-4 pt-1 pb-5 sm:px-5">
      {terms && <p className="rounded-[10px] bg-muted px-3 py-2 text-[13px] leading-relaxed text-secondary-foreground tabular-nums shadow-sunk">{terms}</p>}

      <div>
        <h4 className={label}>Why</h4>
        <ul className="mt-2 flex flex-col gap-1.5">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-secondary-foreground">
              <span aria-hidden className={cx('mt-[8px] size-1.5 shrink-0 rounded-full', r.dot)} />
              <span className="min-w-0">{r.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {deal.draft ? (
        <div>
          <h4 className={label}>Draft reply</h4>
          <div className="mt-2 overflow-hidden rounded-[12px] bg-card shadow-raised">
            <div className="border-b border-border-muted px-4 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
              <p className="truncate">
                To <span className="text-secondary-foreground">{deal.contact.email}</span>
              </p>
              <p className="truncate font-medium text-foreground">{deal.draft.subject}</p>
            </div>
            <p className="px-4 py-3.5 text-[14px] leading-[1.65] break-words whitespace-pre-wrap">{deal.draft.body}</p>
            <div className="flex items-center justify-between gap-3 border-t border-border-muted bg-muted px-4 py-2.5">
              <span className="text-[12px] text-muted-foreground">Nothing is sent for you.</span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex h-8 min-w-[92px] shrink-0 items-center justify-center gap-1.5 rounded-[9px] bg-ink px-3 text-[13px] font-medium text-primary-foreground shadow-ink transition-transform duration-100 hover:bg-ink-hover active:translate-y-px"
              >
                {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-[10px] bg-muted px-3 py-2.5 text-[13.5px] text-secondary-foreground shadow-sunk">{deal.action === 'report' ? 'No reply. Report as phishing.' : 'No reply needed.'}</p>
      )}

      <div>
        <button type="button" onClick={() => setShowEmails(!showEmails)} aria-expanded={showEmails} className="rounded-[4px] text-[12.5px] text-muted-foreground underline decoration-border underline-offset-[3px] hover:text-foreground">
          {showEmails ? 'Hide' : 'Show'} original {emails.length === 1 ? 'email' : 'emails'}
        </button>
        {showEmails && (
          <ul className="mt-3 flex animate-fade-in flex-col gap-4 border-l-2 border-border pl-3.5">
            {emails.map((e) => (
              <li key={e.id} className="min-w-0">
                <p className="text-[13px] font-medium break-words">{e.subject}</p>
                <p className="text-[12px] break-all text-muted-foreground">
                  {e.from} · {shortDate(e.receivedAt)}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">{e.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({ deal, tone, open, onToggle }: { deal: Deal; tone: Tone; open: boolean; onToggle: () => void }) {
  const real = isReal(deal)
  const due = real ? dueText(analysis.today, deal) : null
  const hasMoney = real && (deal.terms.fee || deal.terms.giftValue)
  const scope = real ? scopeText(deal.terms) : null
  return (
    <li id={deal.id} className="relative">
      <span aria-hidden className={cx('absolute inset-y-0 left-0 w-[3px] transition-opacity duration-200', tone.bar, open ? 'opacity-100' : 'opacity-0')} />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${deal.id}-details`}
        className={cx('block w-full px-4 py-3.5 text-left transition-colors duration-150 focus-visible:-outline-offset-2 sm:px-5', !open && 'hover:bg-muted active:bg-accent')}
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="min-w-0 text-[15px] font-semibold tracking-[-0.01em] break-words">{deal.brand}</span>
          {hasMoney && <span className="shrink-0 text-[15px] font-semibold tracking-[-0.01em] tabular-nums">{offerText(deal.terms)}</span>}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground tabular-nums">
          <span className={cx('inline-flex h-[21px] items-center rounded-full px-2 text-[12px] font-medium', tone.pill)}>{ACTION_WORD[deal.action]}</span>
          {scope && <span>{scope}</span>}
          {due && <span className={cx(due.urgent && 'font-medium text-quiet-ink')}>due {due.text}</span>}
        </span>
        <span className="mt-2 block text-[13.5px] leading-relaxed text-secondary-foreground">{deal.why}</span>
      </button>
      <div id={`${deal.id}-details`} inert={!open} className={cx('grid transition-[grid-template-rows,opacity] duration-300 ease-out', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="min-h-0 overflow-hidden">
          <Details deal={deal} />
        </div>
      </div>
    </li>
  )
}

function Stat({ value, label: text }: { value: string; label: string }) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-4">
      <p className="text-[18px] leading-none font-semibold tracking-[-0.02em] tabular-nums sm:text-[20px]">{value}</p>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{text}</p>
    </div>
  )
}

export function App() {
  const { dark, toggle } = useTheme()
  // A link like #D-01 opens that row.
  const [openId, setOpenId] = useState<string | null>(() => window.location.hash.slice(1) || null)
  const firstName = analysis.generatedFor.split(' ')[0]
  return (
    <div data-scrollbar className="h-full overflow-y-auto">
      <main className="mx-auto max-w-[640px] px-4 pt-8 pb-20 sm:px-6 sm:pt-14">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12.5px] text-muted-foreground">{shortDate(analysis.today, true)}</p>
            <h1 className="mt-1 text-[28px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[32px]">{firstName}’s brand inbox</h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-secondary-foreground">{summary()}</p>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-card text-secondary-foreground shadow-raised hover:shadow-raised-hover active:translate-y-px"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </header>

        <div className="mt-6 grid grid-cols-3 divide-x divide-border-muted rounded-[14px] bg-card shadow-raised">
          <Stat value={inr(onOffer)} label="in offers" />
          <Stat value={String(replies.length)} label={replies.length === 1 ? 'reply to send' : 'replies to send'} />
          <Stat value={String(scamEmails)} label={scamEmails === 1 ? 'scam to report' : 'scams to report'} />
        </div>

        {SECTIONS.map((s, i) => {
          const deals = inSection(i)
          if (!deals.length) return null
          return (
            <section key={s.title} className="mt-9">
              <h2 className="flex items-center gap-2 px-1 text-[13.5px] font-semibold tracking-[-0.005em]">
                <span aria-hidden className={cx('size-2 rounded-full', s.tone.dot)} />
                {s.title}
                <span className="font-normal text-subtle-foreground tabular-nums">{deals.length}</span>
              </h2>
              <ul className="mt-2.5 divide-y divide-border-muted overflow-hidden rounded-[14px] bg-card shadow-raised">
                {deals.map((d) => (
                  <Row key={d.id} deal={d} tone={s.tone} open={openId === d.id} onToggle={() => setOpenId(openId === d.id ? null : d.id)} />
                ))}
              </ul>
            </section>
          )
        })}

        <p className="mt-12 px-1 text-center text-[12px] leading-relaxed text-subtle-foreground">A model reads each email; code checks the quotes, does the maths and decides. Nothing is sent.</p>
      </main>
    </div>
  )
}
