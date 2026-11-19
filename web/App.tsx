import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import raw from '../out/analysis.json'
import type { Analysis, Deal, EmailResult } from '../src/types'
import { ACTION_WORD, GROUPS, copyText, due, inr, longDate, money, offerText, scopeText, shortDate, word } from './lib'

// The UI renders exactly what `npm run analyze` wrote. It runs no logic of its own.
const analysis = raw as unknown as Analysis
const today = analysis.today
const firstName = analysis.generatedFor.split(' ')[0]

const groups = GROUPS.map((g) => ({
  ...g,
  deals: analysis.deals.filter((d) => g.actions.includes(d.action)).sort((a, b) => a.rank - b.rank),
})).filter((g) => g.deals.length)
const ordered = groups.flatMap((g) => g.deals)
const count = (key: string) => groups.find((g) => g.key === key)?.deals.length ?? 0
const onTable = (groups.find((g) => g.key === 'reply')?.deals ?? []).reduce((sum, d) => sum + (d.terms.fee?.inr ?? 0), 0)

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
  const [selected, select] = useSelection()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const deal = ordered.find((d) => d.id === selected) ?? null

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('winnow-theme', dark ? 'dark' : 'light')
    } catch {
      /* private mode: the choice just does not persist */
    }
  }, [dark])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape' && selected) {
        e.preventDefault()
        select(null)
        document.querySelector<HTMLElement>(`[data-deal="${selected}"]`)?.focus()
        return
      }
      const step = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0
      if (!step) return
      e.preventDefault()
      const at = ordered.findIndex((d) => d.id === selected)
      const next = ordered[at === -1 ? (step === 1 ? 0 : ordered.length - 1) : Math.min(ordered.length - 1, Math.max(0, at + step))]
      select(next.id)
      document.querySelector<HTMLElement>(`[data-deal="${next.id}"]`)?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, select])

  // On small screens the detail is a full-screen sheet, so the page behind it must not scroll.
  useEffect(() => {
    document.body.classList.toggle('sheet-open', !!deal)
  }, [deal])

  return (
    <div className={deal ? 'shell has-panel' : 'shell'}>
      <main className="page">
        <header className="mast">
          <span className="wordmark">Winnow</span>
          <span className="mast-date">{longDate(today)}</span>
          <button type="button" className="quiet-btn" onClick={() => setDark((d) => !d)} aria-label="Switch colour theme">
            {dark ? 'Light' : 'Dark'}
          </button>
        </header>

        <section className="brief" aria-label="Today's brief">
          <p className="eyebrow">
            {firstName}&rsquo;s brand inbox <span className="sep">/</span> {analysis.emails.length} emails read
          </p>
          <h1>
            {word(count('reply'))} brands are waiting on a reply from you, with <em className="fig"><span className="rs">₹</span>{onTable.toLocaleString('en-IN')}</em> on the table.{' '}
            <span className="h1-rest">
              {word(count('decline'))} to turn down, <em className="warn">{word(count('report')).toLowerCase()} scams</em> to report
              {count('ignore') ? `, ${word(count('ignore')).toLowerCase()} to ignore` : ''}.
            </span>
          </h1>
        </section>

        <section className="ledger" aria-label="Deals">
          <div className="row head" aria-hidden="true">
            <span>No.</span>
            <span>Brand</span>
            <span>What to do</span>
            <span className="r">Offer</span>
            <span className="r">Go-live</span>
          </div>
          {groups.map((g) => (
            <div key={g.key} className={`group g-${g.key}`}>
              <h2>
                <span className="g-title">{g.title}</span>
                <span className="g-count">{String(g.deals.length).padStart(2, '0')}</span>
                <span className="g-note">{g.note}</span>
              </h2>
              {g.deals.map((d) => (
                <Row key={d.id} deal={d} active={d.id === selected} onOpen={() => select(d.id === selected ? null : d.id)} />
              ))}
            </div>
          ))}
        </section>

        <footer className="foot">
          <span>
            Read by {analysis.stats.model} <span className="sep">/</span> decided by code <span className="sep">/</span> {analysis.stats.calls} calls
          </span>
          <span className="keys">
            <kbd>↑</kbd>
            <kbd>↓</kbd> move <kbd>Esc</kbd> close
          </span>
        </footer>
      </main>

      {deal && <Panel key="panel" deal={deal} onClose={() => select(null)} />}
    </div>
  )
}

function Row({ deal, active, onOpen }: { deal: Deal; active: boolean; onOpen: () => void }) {
  const offer = offerText(deal.terms)
  const d = due(today, deal)
  const scope = scopeText(deal.terms)
  return (
    <button type="button" className={`row deal a-${deal.action}`} data-deal={deal.id} aria-pressed={active} onClick={onOpen}>
      <span className="c-rank">{String(deal.rank).padStart(2, '0')}</span>
      <span className="c-brand">
        <span className="brand">{deal.brand}</span>
        <span className="sub">{scope ?? deal.contact.email}</span>
      </span>
      <span className="c-do">
        <span className="act">{ACTION_WORD[deal.action]}</span>
        <span className="why">{deal.why}</span>
      </span>
      <span className="c-money r">
        <span className="amt">{offer ?? '—'}</span>
        {deal.counter ? (
          <span className="sub counter">counter {money(deal.counter.amount, deal.counter.currency)}</span>
        ) : deal.terms.fee?.currency === 'USD' ? (
          <span className="sub">≈ {inr(deal.terms.fee.inr)}</span>
        ) : null}
      </span>
      <span className="c-due r">
        <span className={d?.late ? 'late' : undefined}>{d ? d.date : '—'}</span>
        {d && <span className={d.late ? 'sub late' : 'sub'}>{d.note}</span>}
      </span>
    </button>
  )
}

function Panel({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const scam = deal.action === 'report'
  const emails = useMemo(() => analysis.emails.filter((e) => deal.emailIds.includes(e.id)), [deal])
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [deal.id])

  const t = deal.terms
  const d = due(today, deal)
  const offer = offerText(t)
  const said = (t.usage?.text ?? '').toLowerCase()
  const usage = t.usage
    ? [t.usage.text, t.usage.perpetual && 'perpetual', t.usage.paidAds && 'paid ads', t.usage.whitelisting && 'whitelisting'].filter((u) => u && (u === t.usage!.text || !said.includes(u.replace('paid ads', 'ads'))))
    : []
  const terms: [string, React.ReactNode][] = []
  if (scopeText(t)) terms.push(['Deliverables', scopeText(t)])
  if (t.product) terms.push(['For', t.product])
  if (t.paymentType !== 'not_stated') terms.push(['Payment', { cash: 'Cash', gifting: 'Gifting only', cash_and_gifting: 'Cash + gifting', commission_only: 'Commission only', not_stated: '' }[t.paymentType]])
  if (t.deadline?.date || t.deadline?.text)
    terms.push([
      'Go-live',
      <>
        {t.deadline.date ? shortDate(t.deadline.date, true) : t.deadline.text}
        {d && <span className={d.late ? 'aside late' : 'aside'}>{d.note}</span>}
      </>,
    ])
  if (usage.length) terms.push(['Usage', [...new Set(usage)].join(', ')])
  if (t.otherTerms.length) terms.push(['Also', t.otherTerms.join('; ')])
  for (const h of deal.history)
    terms.push([
      `${h.field} moved`,
      <>
        <s>{h.from}</s> → {h.to}
      </>,
    ])
  // A scam's "terms" are bait, not terms: show only who sent it.
  if (scam) terms.length = 0
  terms.push(['From', [deal.contact.name, deal.contact.org, deal.contact.email].filter(Boolean).join(', ')])

  return (
    <aside className={scam ? 'panel scam' : 'panel'} aria-label={`${deal.brand} details`}>
      <div className="panel-bar">
        <span className="eyebrow">
          {String(deal.rank).padStart(2, '0')} <span className="sep">/</span> {deal.brand}
        </span>
        <button type="button" className="quiet-btn" onClick={onClose}>
          Close <kbd>Esc</kbd>
        </button>
      </div>

      <div className="panel-scroll" ref={scroller}>
        <article key={deal.id} className="sheet">
          {scam && <p className="alarm">Scam. Do not reply, pay or click.</p>}
          <p className="verdict-label">{scam ? 'Report as phishing' : ACTION_WORD[deal.action]}</p>
          <h2 className="verdict">{deal.why}</h2>

          {(offer || deal.rate || deal.counter) && !scam && (
            <div className="figures">
              <Figure label="They offer" value={offer ?? 'No fee'} note={t.fee?.currency === 'USD' ? `≈ ${inr(t.fee.inr)}` : t.fee?.currencyAssumed ? 'currency assumed' : undefined} />
              {deal.rate && (
                <Figure
                  label="Your rate card"
                  value={inr(deal.rate.rateCardInr)}
                  note={deal.rate.offeredInr > 0 ? `offer is ${Math.abs(deal.rate.gapPct)}% ${deal.rate.gapPct < 0 ? 'below' : 'above'}` : undefined}
                />
              )}
              {deal.counter && <Figure label="Counter with" value={money(deal.counter.amount, deal.counter.currency)} accent />}
            </div>
          )}

          {(terms.length > 1 || scam) && (
            <section>
              <h3>{scam ? 'Sent by' : 'Terms'}</h3>
              <dl className="terms">
                {terms.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {deal.flags.length > 0 && (
            <section>
              <h3>{scam ? 'Why it is a scam' : 'Why'}</h3>
              <ol className="reasons">
                {deal.flags.map((f, i) => (
                  <li key={f.code + i}>
                    <span className="n">{i + 1}</span>
                    <div>
                      <p className="r-title">
                        {f.title}
                        <span className={`sev s-${f.severity}`}>{f.severity}</span>
                      </p>
                      <p className="r-text">{f.reason}</p>
                      {f.evidence && <blockquote>&ldquo;{f.evidence}&rdquo;</blockquote>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {deal.draft ? (
            <Letter deal={deal} />
          ) : (
            <section>
              <h3>Reply</h3>
              <p className="no-draft">{scam ? 'No reply drafted, on purpose. Report it in your mail app and move on.' : 'Nothing to send.'}</p>
            </section>
          )}

          <section>
            <h3>{emails.length > 1 ? `The ${emails.length} emails` : 'The email'}</h3>
            {emails.map((e) => (
              <Original key={e.id} email={e} open={emails.length === 1 && scam} />
            ))}
          </section>
        </article>
      </div>
    </aside>
  )
}

function Figure({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div className={accent ? 'figure accent' : 'figure'}>
      <span className="f-label">{label}</span>
      <span className="f-value">{value}</span>
      {note && <span className="f-note">{note}</span>}
    </div>
  )
}

function Letter({ deal }: { deal: Deal }) {
  const draft = deal.draft!
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    if (!(await copyText(draft.body))) return
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1800)
  }
  return (
    <section>
      <h3>Your reply</h3>
      <div className="letter">
        <div className="letter-head">
          <span>To</span>
          <span>{deal.contact.email}</span>
          <span>Re</span>
          <span>{draft.subject.replace(/^re:\s*/i, '')}</span>
        </div>
        <p className="letter-body">{draft.body}</p>
        <div className="letter-foot">
          <button type="button" className={copied ? 'copy done' : 'copy'} onClick={copy}>
            <span aria-live="polite">{copied ? 'Copied' : 'Copy reply'}</span>
          </button>
          <span className="letter-note">
            {draft.language}
            {draft.source === 'template' ? ', from a template' : ''}. Nothing is sent for you.
          </span>
        </div>
      </div>
    </section>
  )
}

function Original({ email, open }: { email: EmailResult; open: boolean }) {
  return (
    <details className="original" open={open}>
      <summary>
        <span className="o-subject">{email.subject}</span>
        <span className="o-meta">{shortDate(email.receivedAt)}</span>
      </summary>
      <p className="o-from">{email.from}</p>
      <p className="o-body">{email.body}</p>
    </details>
  )
}
