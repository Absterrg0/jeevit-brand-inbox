import { useCallback, useEffect, useRef, useState } from 'react'
import raw from '../out/analysis.json'
import type { Analysis, Deal, EmailResult, Flag } from '../src/types'
import { ACTION_WORD, GROUPS, copyText, due, inr, money, offerText, scopeText, shortDate } from './lib'

// The UI renders exactly what `npm run analyze` wrote. It runs no logic of its own.
const analysis = raw as unknown as Analysis
const today = analysis.today
const emailsById = new Map<string, EmailResult>(analysis.emails.map((e) => [e.id, e]))

const groups = GROUPS.map((g) => ({
  ...g,
  deals: analysis.deals.filter((d) => g.actions.includes(d.action)).sort((a, b) => a.rank - b.rank),
})).filter((g) => g.deals.length)
const ordered = groups.flatMap((g) => g.deals)
const count = (key: string) => groups.find((g) => g.key === key)?.deals.length ?? 0
const onTable = (groups.find((g) => g.key === 'reply')?.deals ?? []).reduce((sum, d) => sum + (d.terms.fee?.inr ?? 0), 0)
const tone = (d: Deal) => (d.action === 'report' ? 'scam' : d.action === 'decline' ? 'decline' : d.action === 'ignore' ? 'muted' : 'reply')

const MOBILE = '(max-width: 899px)'
function useMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

function useSelection() {
  const read = () => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    return ordered.some((d) => d.id === id) ? id : null
  }
  const [id, setId] = useState<string | null>(read)
  useEffect(() => {
    const onHash = () => setId(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const select = useCallback((next: string | null) => {
    setId(next)
    history.replaceState(null, '', next ? `#${next}` : window.location.pathname + window.location.search)
  }, [])
  return [id, select] as const
}

export function App() {
  const mobile = useMobile()
  const [picked, select] = useSelection()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  // On a wide screen the detail is always showing, so fall back to the first deal.
  const deal = ordered.find((d) => d.id === picked) ?? (mobile ? null : ordered[0])
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('winnow-theme', dark ? 'dark' : 'light')
    } catch {
      /* private mode: the choice just does not persist */
    }
  }, [dark])

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 })
  }, [deal?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape' && mobile && deal) {
        e.preventDefault()
        select(null)
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-deal="${deal.id}"]`)?.focus())
        return
      }
      const step = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0
      if (!step) return
      e.preventDefault()
      const at = deal ? ordered.indexOf(deal) : -1
      const next = ordered[at === -1 ? 0 : Math.min(ordered.length - 1, Math.max(0, at + step))]
      select(next.id)
      const row = document.querySelector<HTMLElement>(`[data-deal="${next.id}"]`)
      row?.scrollIntoView({ block: 'nearest' })
      if (!mobile) row?.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deal, mobile, select])

  useEffect(() => {
    document.body.classList.toggle('sheet-open', mobile && !!deal)
  }, [mobile, deal])

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 16 16" width="12" height="12">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </span>
          <span className="brand-name">Winnow</span>
          <span className="brand-for">{analysis.generatedFor}</span>
        </div>
        <dl className="stats" aria-label="Summary">
          <Stat label="deals" value={String(analysis.deals.length)} />
          <Stat label="to reply" value={String(count('reply'))} tone="reply" />
          <Stat label="to decline" value={String(count('decline'))} tone="decline" />
          <Stat label="scams" value={String(count('report'))} tone="scam" />
          <Stat label="on the table" value={inr(onTable)} wide />
        </dl>
        <div className="bar-end">
          <span className="today">{shortDate(today, true)}</span>
          <button className="icon-btn" onClick={() => setDark((v) => !v)} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title="Theme">
            {dark ? (
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
                <circle cx="8" cy="8" r="3" fill="currentColor" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
                <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="body">
        <nav className="queue" aria-label="Deals">
          <div className="queue-head">
            <h1>Inbox</h1>
            <span className="kbd-hint">
              <kbd>↑</kbd>
              <kbd>↓</kbd> to move
            </span>
          </div>
          {groups.map((g) => (
            <section key={g.key} className="group" aria-labelledby={`g-${g.key}`}>
              <h2 id={`g-${g.key}`} className={`group-title t-${g.key === 'report' ? 'scam' : g.key === 'ignore' ? 'muted' : g.key}`}>
                <span className="dot" />
                {g.title}
                <span className="group-count">{g.deals.length}</span>
              </h2>
              <ul>
                {g.deals.map((d) => (
                  <li key={d.id}>
                    <Row deal={d} active={deal?.id === d.id} onPick={() => select(d.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <main className={`detail${deal ? ' open' : ''}`} ref={detailRef} aria-label="Deal">
          {deal && <Detail key={deal.id} deal={deal} mobile={mobile} onBack={() => select(null)} />}
        </main>
      </div>
    </div>
  )
}

function Stat({ label, value, tone, wide }: { label: string; value: string; tone?: string; wide?: boolean }) {
  return (
    <div className={`stat${wide ? ' stat-wide' : ''}`}>
      <dd className={tone ? `t-${tone}` : undefined}>
        {tone && <span className="dot" />}
        {value}
      </dd>
      <dt>{label}</dt>
    </div>
  )
}

function Row({ deal, active, onPick }: { deal: Deal; active: boolean; onPick: () => void }) {
  const offer = deal.action === 'report' ? null : offerText(deal.terms)
  const latest = emailsById.get(deal.latestEmailId)
  const high = deal.flags.filter((f) => f.severity === 'high').length
  return (
    <button className={`row${active ? ' active' : ''}`} data-deal={deal.id} onClick={onPick} aria-current={active ? 'true' : undefined}>
      <span className="row-top">
        <span className="row-brand">{deal.brand}</span>
        <span className="row-offer num">{offer ?? '—'}</span>
      </span>
      <span className="row-sub">{latest?.subject ?? deal.why}</span>
      <span className="row-meta">
        <span className={`chip t-${tone(deal)}`}>{ACTION_WORD[deal.action]}</span>
        {high > 0 && deal.action !== 'report' && (
          <span className="row-flag">
            {high} {high === 1 ? 'risk' : 'risks'}
          </span>
        )}
        {deal.emailIds.length > 1 && <span className="row-thread">{deal.emailIds.length} emails</span>}
        <span className="row-date num">{latest ? shortDate(latest.receivedAt) : ''}</span>
      </span>
    </button>
  )
}

function Detail({ deal, mobile, onBack }: { deal: Deal; mobile: boolean; onBack: () => void }) {
  const t = deal.terms
  const when = due(today, deal)
  const scope = scopeText(t)
  const emails = deal.emailIds.map((id) => emailsById.get(id)).filter((e): e is EmailResult => !!e)
  const latest = emailsById.get(deal.latestEmailId)
  const scam = deal.action === 'report'
  const contact = [deal.contact.name, deal.contact.org].filter(Boolean).join(', ')

  const usage = t.usage
    ? t.usage.perpetual
      ? 'Perpetual'
      : t.usage.months
        ? `${t.usage.months} months${t.usage.paidAds ? ', paid ads' : ''}${t.usage.whitelisting ? ', whitelisting' : ''}`
        : (t.usage.text ?? 'Mentioned')
    : null

  return (
    <article className="sheet">
      {mobile && (
        <div className="sheet-bar">
          <button className="back" onClick={onBack}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Inbox
          </button>
        </div>
      )}
      <div className="sheet-inner">
        <header className="d-head">
          <div className="d-kicker">
            <span className={`chip lg t-${tone(deal)}`}>
              <span className="dot" />
              {ACTION_WORD[deal.action]}
            </span>
            {latest && <span className="d-received num">Received {shortDate(latest.receivedAt, true)}</span>}
          </div>
          <h2 className="d-brand">{deal.brand}</h2>
          <p className="d-contact">
            {contact && <span>{contact}</span>}
            <span>{deal.contact.email}</span>
          </p>
          <p className={`d-why t-${tone(deal)}`}>{deal.why}</p>
        </header>

        <section className="block">
          {scam ? (
            <div className="warning" role="alert">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
                <path d="M10 2.5 18 17H2L10 2.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M10 8v4M10 14.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <div>
                <h3>Do not reply, pay, or click any link</h3>
                <p>This looks like a scam, so there is no draft. Report the sender as phishing in your mail app and delete it. If you clicked something, change your passwords.</p>
              </div>
            </div>
          ) : deal.draft ? (
            <Draft draft={deal.draft} />
          ) : (
            <p className="none-note">No reply needed.</p>
          )}
        </section>

        {!scam && (
          <section className="block" aria-label="Terms">
            <dl className="terms">
              <Term label="Offer">
                {offerText(t) ? (
                  <>
                    <span className="num strong">{offerText(t)}</span>
                    {t.fee && t.fee.currency !== 'INR' && <span className="sub num">≈ {inr(t.fee.inr)}</span>}
                    {t.fee?.currencyAssumed && <span className="sub">Currency assumed INR</span>}
                  </>
                ) : (
                  <span className="none">Not stated</span>
                )}
              </Term>
              <Term label="Deliverables">{scope ? <span>{scope}</span> : <span className="none">Not stated</span>}</Term>
              <Term label="Go-live">
                {when ? (
                  <>
                    <span className="num">{when.date}</span>
                    <span className={`sub${when.late ? ' t-scam-ink' : ''}`}>{when.note}</span>
                  </>
                ) : (
                  <span className="none">Not stated</span>
                )}
              </Term>
              <Term label="Usage rights">{usage ? <span>{usage}</span> : <span className="none">Not stated</span>}</Term>
              {deal.rate && (
                <Term label="Your rate card">
                  <span className="num">{inr(deal.rate.rateCardInr)}</span>
                  <span className={`sub num ${deal.rate.gapPct < 0 ? 't-decline-ink' : 't-ok-ink'}`}>
                    Offer is {Math.abs(deal.rate.gapPct)}% {deal.rate.gapPct < 0 ? 'below' : 'above'}
                  </span>
                </Term>
              )}
              {deal.counter && (
                <Term label="Counter with">
                  <span className="num strong t-reply-ink">{money(deal.counter.amount, deal.counter.currency)}</span>
                  {deal.counter.currency !== 'INR' && <span className="sub">in their currency</span>}
                </Term>
              )}
            </dl>
            {t.product && <p className="product">{t.product}</p>}
          </section>
        )}

        {deal.flags.length > 0 && (
          <section className="block">
            <h3 className="label">
              Why it needs care <span className="count">{deal.flags.length}</span>
            </h3>
            <ul className="flags">
              {deal.flags.map((f, i) => (
                <FlagItem key={i} flag={f} />
              ))}
            </ul>
          </section>
        )}


        <section className="block">
          <h3 className="label">
            Original {emails.length === 1 ? 'email' : 'emails'} <span className="count">{emails.length}</span>
          </h3>
          <div className="emails">
            {emails.map((e, i) => (
              <details key={e.id} className="email" open={i === emails.length - 1 && !scam}>
                <summary>
                  <span className="e-subject">{e.subject}</span>
                  <span className="e-from">{e.from}</span>
                  <span className="e-date num">{shortDate(e.receivedAt)}</span>
                </summary>
                <pre className="e-body">{e.body}</pre>
              </details>
            ))}
          </div>
        </section>
      </div>
    </article>
  )
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="term">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function FlagItem({ flag }: { flag: Flag }) {
  return (
    <li className={`flag sev-${flag.severity}`}>
      <span className="sev" aria-label={`${flag.severity} severity`}>
        {flag.severity}
      </span>
      <div className="flag-body">
        <p className="flag-title">{flag.title}</p>
        <p className="flag-reason">{flag.reason}</p>
        {flag.evidence && <blockquote>“{flag.evidence}”</blockquote>}
      </div>
    </li>
  )
}

function Draft({ draft }: { draft: NonNullable<Deal['draft']> }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    const ok = await copyText(`Subject: ${draft.subject}\n\n${draft.body}`)
    setState(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1800)
  }
  return (
    <div className="draft">
      <div className="draft-head">
        <h3 className="label">Draft reply</h3>
        <button className={`copy${state === 'copied' ? ' done' : ''}`} onClick={copy}>
          {state === 'copied' ? (
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
              <path d="m3 8.5 3 3 7-7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
              <rect x="5" y="5" width="8.5" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M3 10.5V4a1.5 1.5 0 0 1 1.5-1.5H10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
          <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy reply'}</span>
        </button>
      </div>
      <div className="draft-card">
        <p className="draft-subject">
          <span>Subject</span>
          {draft.subject}
        </p>
        <pre className="draft-body">{draft.body}</pre>
      </div>
    </div>
  )
}
