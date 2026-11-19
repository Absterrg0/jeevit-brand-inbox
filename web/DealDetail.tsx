import { ArrowLeft, Check, Copy, MailX } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Analysis, Deal, EmailResult, Flag } from '../src/types'
import { cx, dueText, inr, offerText, scopeText, shortDate } from './lib'
import { ACTION, BrandTile, Button, CATEGORY, CategoryChip, Chip, SectionTitle, SEVERITY } from './ui'

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-muted px-3 py-2.5">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[13.5px] leading-snug text-foreground">{children}</dd>
    </div>
  )
}

function Terms({ deal, today }: { deal: Deal; today: string }) {
  const t = deal.terms
  const due = dueText(today, deal)
  const usage = t.usage ? (t.usage.perpetual ? 'Perpetual' : t.usage.months ? `${t.usage.months} month${t.usage.months === 1 ? '' : 's'}` : (t.usage.text ?? 'Stated')) : null
  const none = <span className="text-subtle-foreground">Not stated</span>
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] bg-border-muted shadow-sunk sm:grid-cols-3">
      <Property label="Offer">
        <span className="font-medium tabular-nums">{offerText(t)}</span>
        {t.fee?.currency === 'USD' && <span className="text-muted-foreground"> · {inr(t.fee.inr)}</span>}
      </Property>
      <Property label="Your rate card">
        {deal.rate ? (
          <>
            <span className="tabular-nums">{inr(deal.rate.rateCardInr)}</span>
            {t.fee && (
              <span className={cx('ml-1.5 tabular-nums', deal.rate.gapPct < 0 ? 'font-medium text-quiet-ink' : 'text-muted-foreground')}>
                {deal.rate.gapPct > 0 ? '+' : ''}
                {deal.rate.gapPct}%
              </span>
            )}
          </>
        ) : (
          <span className="text-subtle-foreground">Nothing to price</span>
        )}
      </Property>
      <Property label="Counter with">
        {deal.counter ? <span className="font-medium tabular-nums">{deal.counter.currency === 'USD' ? `$${deal.counter.amount.toLocaleString('en-US')}` : inr(deal.counter.amount)}</span> : <span className="text-subtle-foreground">No counter</span>}
      </Property>
      <Property label="Deliverables">{scopeText(t) ?? none}</Property>
      <Property label="Go live">{due ? <span className={cx(due.urgent && 'font-medium text-quiet-ink')}>{due.text}</span> : none}</Property>
      <Property label="Usage rights">
        {usage ? (
          <>
            {usage}
            {t.usage?.whitelisting && <span className="text-muted-foreground"> · whitelisting</span>}
          </>
        ) : (
          none
        )}
      </Property>
    </dl>
  )
}

function Risk({ flag }: { flag: Flag }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span aria-label={`${SEVERITY[flag.severity].label} severity`} className={cx('mt-[7px] size-2 shrink-0 rounded-full', SEVERITY[flag.severity].dot)} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-foreground">{flag.title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-secondary-foreground">{flag.reason}</p>
        {flag.evidence && <p className="mt-1.5 border-l-2 border-border pl-2.5 text-[12.5px] leading-relaxed text-muted-foreground italic">“{flag.evidence}”</p>}
        <p className="mt-1.5 text-[11.5px] text-subtle-foreground">{flag.source === 'code' ? 'Checked by code' : 'Spotted by the model, quote verified in the email'}</p>
      </div>
    </li>
  )
}

function Draft({ deal }: { deal: Deal }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [deal.id])
  if (!deal.draft) {
    return (
      <div className="flex items-start gap-3 rounded-[12px] bg-muted px-3.5 py-3 shadow-sunk">
        <MailX aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-[13px] leading-relaxed text-secondary-foreground">
          {deal.action === 'report' ? 'No reply is drafted for a scam. Do not answer, click or pay. Report it as phishing in your mail app.' : 'No reply needed.'}
        </p>
      </div>
    )
  }
  const copy = async () => {
    await navigator.clipboard.writeText(deal.draft!.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="overflow-hidden rounded-[12px] bg-muted shadow-sunk">
      <div className="flex items-center gap-2 border-b border-border-muted px-3.5 py-2">
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
          To <span className="text-secondary-foreground">{deal.contact.email}</span> · {deal.draft.subject}
        </p>
        <Button variant="primary" onClick={copy} aria-live="polite">
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="px-3.5 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap text-foreground">{deal.draft.body}</p>
      <p className="border-t border-border-muted px-3.5 py-2 text-[11.5px] text-subtle-foreground">
        {deal.draft.source === 'model' ? `Worded by the model in ${deal.draft.language} from points set by code` : 'Template wording (the model draft was rejected or unavailable)'} · Nothing is sent
      </p>
    </div>
  )
}

function ThreadEmail({ email, latest }: { email: EmailResult; latest: boolean }) {
  return (
    <li className="rounded-[12px] bg-card p-3.5 shadow-raised">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-[11.5px] text-muted-foreground">{email.id}</span>
        <span className="min-w-0 truncate text-[13px] font-medium">{email.from}</span>
        <span className="ml-auto text-[12px] whitespace-nowrap text-muted-foreground tabular-nums">{shortDate(email.receivedAt)}</span>
      </div>
      <p className="mt-1 text-[13px] text-secondary-foreground">{email.subject}</p>
      <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{email.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CategoryChip category={email.category} />
        {latest && <Chip>Latest terms</Chip>}
        {email.modelCategory && email.modelCategory !== email.category && (
          <span className="text-[11.5px] text-subtle-foreground">Model alone guessed “{CATEGORY[email.modelCategory].label.toLowerCase()}”; code decided otherwise.</span>
        )}
      </div>
    </li>
  )
}

export function DealDetail({ deal, analysis, onBack }: { deal: Deal; analysis: Analysis; onBack: () => void }) {
  const { label, icon: Icon } = ACTION[deal.action]
  const emails = deal.emailIds.map((id) => analysis.emails.find((e) => e.id === id)!)
  const feeMove = deal.history.filter((h) => h.field === 'fee').at(-1)
  return (
    <article data-scrollbar className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col gap-7 px-4 pt-4 pb-10 sm:px-7 sm:pt-6">
        <header className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to the list" className="-ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden">
            <ArrowLeft className="size-4" />
          </button>
          <BrandTile name={deal.brand} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[19px] leading-tight font-semibold tracking-[-0.02em]">{deal.brand}</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
              {deal.contact.name ? `${deal.contact.name} · ` : ''}
              {deal.contact.email}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <CategoryChip category={deal.category} />
          </div>
        </header>

        <section className="rounded-[14px] bg-card p-4 shadow-raised">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-ink text-primary-foreground shadow-ink">
              <Icon aria-hidden className="size-4" />
            </span>
            <div>
              <p className="text-[11.5px] text-muted-foreground">Recommended next step</p>
              <p className="text-[15px] leading-tight font-semibold tracking-[-0.01em]">{label}</p>
            </div>
            <div className="ml-auto sm:hidden">
              <CategoryChip category={deal.category} />
            </div>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-secondary-foreground">{deal.why}</p>
          {feeMove && (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Their fee moved from {feeMove.from} to {feeMove.to} in {feeMove.emailId}.
            </p>
          )}
        </section>

        {(deal.category === 'deal_offer' || deal.category === 'not_a_fit' || deal.category === 'needs_more_info') && (
          <section>
            <SectionTitle>The deal, using the latest terms</SectionTitle>
            <Terms deal={deal} today={analysis.today} />
            {deal.terms.otherTerms.length > 0 && <p className="mt-2 text-[12.5px] text-muted-foreground">Also in the emails: {deal.terms.otherTerms.join(' · ')}</p>}
          </section>
        )}

        <section>
          <SectionTitle aside={deal.flags.length > 0 && <span className="text-[12px] text-subtle-foreground tabular-nums">{deal.flags.length}</span>}>What to watch</SectionTitle>
          {deal.flags.length ? (
            <ul className="divide-y divide-border-muted">
              {deal.flags.map((f, i) => (
                <Risk key={`${f.code}-${i}`} flag={f} />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">Nothing flagged against your rates, rules or exclusivity.</p>
          )}
        </section>

        <section>
          <SectionTitle>Draft reply</SectionTitle>
          <Draft deal={deal} />
        </section>

        <section>
          <SectionTitle aside={<span className="text-[12px] text-subtle-foreground tabular-nums">{emails.length}</span>}>{emails.length > 1 ? 'Emails in this deal' : 'The email'}</SectionTitle>
          <ul className="flex flex-col gap-2.5">
            {emails.map((e) => (
              <ThreadEmail key={e.id} email={e} latest={emails.length > 1 && e.id === deal.latestEmailId} />
            ))}
          </ul>
        </section>
      </div>
    </article>
  )
}
