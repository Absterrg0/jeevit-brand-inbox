import { Check, Clipboard, CornerDownRight, Mail, ShieldAlert, Sparkles, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import type { Deal, EmailAnalysis } from '../engine/types'
import { deliverableText } from '../engine/assess'
import { cx } from '../lib/cx'
import { deltaLabel, formatInr, money, moneyNote, platformLabel, receivedLabel, usageText, whenLabel } from '../lib/format'
import { ACTION_META, CATEGORY_META, SEVERITY_META, SEVERITY_ORDER } from '../lib/meta'
import { Button } from './ui/Button'
import { Callout, SectionHeading } from './Page'
import { ActionChip, BrandTile, CategoryChip, Empty, Meter, Property, RiskBadge } from './ui/primitives'

export function DealSheet({
  deal,
  today,
  onOpenEmail,
  onCopy,
}: {
  deal: Deal
  today: string
  onOpenEmail: (email: EmailAnalysis) => void
  onCopy: (message: string) => void
}) {
  return <DealSheetBody deal={deal} today={today} onOpenEmail={onOpenEmail} onCopy={onCopy} />
}

export function dealHeader(deal: Deal) {
  return <BrandTile name={deal.brand} size="lg" />
}

export function DealSheetBody({
  deal,
  today,
  onOpenEmail,
  onCopy,
}: {
  deal: Deal
  today: string
  onOpenEmail: (email: EmailAnalysis) => void
  onCopy: (message: string) => void
}) {
  const rate = deal.rate
  const fee = deal.terms.fee
  const due = whenLabel(deal, today)
  const usage = usageText(deal.terms.usage)
  const risks = [...deal.risks].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const latest = deal.emails[deal.emails.length - 1]
  const action = ACTION_META[deal.action]

  const ratio = rate.rateInr > 0 && rate.offeredInr !== null ? rate.offeredInr / rate.rateInr : null
  const delta = deltaLabel(deal)

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryChip category={deal.category} />
        <ActionChip action={deal.action} raised />
        {deal.termsChanged && (
          <span className="inline-flex h-[22px] items-center gap-1 rounded-[7px] bg-quiet-soft px-2 text-[11.5px] font-medium text-quiet-ink">
            <TrendingDown aria-hidden className="size-3" />
            Terms revised
          </span>
        )}
      </div>

      <Callout icon={<Sparkles />} title={`${action.label} — the recommended step`}>
        {deal.actionReason}
      </Callout>

      {deal.feeCut !== null && deal.feeCut > 0 && (
        <Callout icon={<TrendingDown />} tone="quiet" title={`The fee fell ${formatInr(deal.feeCut)} across this thread`}>
          Earlier emails offered more. Everything below uses the latest terms, not the best ones.
        </Callout>
      )}

      {/* Money */}
      <section>
        <SectionHeading title="The money" aside={rate.proxyFor?.length ? 'One line uses an integration as a proxy' : undefined} />
        <div className="rounded-[13px] bg-muted p-3.5 shadow-sunk">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11.5px] text-muted-foreground">Latest fee</p>
              <p className="mt-0.5 text-[26px] leading-8 font-semibold tracking-[-0.03em] tabular-nums">
                {fee ? money(fee) : <span className="text-[16px] font-medium text-muted-foreground">No fee stated</span>}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {fee ? (fee.basis === 'gifting' ? `Gift only · ${moneyNote(fee) ?? 'no cash'}` : (moneyNote(fee) ?? `${formatInr(fee.inr)} cash`)) : 'Nothing to price yet'}
              </p>
            </div>
            {rate.rateInr > 0 && (
              <div className="shrink-0 text-right">
                <p className="text-[11.5px] text-muted-foreground">Your rate</p>
                <p className="mt-0.5 text-[15px] font-medium tabular-nums">{formatInr(rate.rateInr)}</p>
                {delta && (
                  <p className={cx('mt-0.5 text-[11.5px] tabular-nums', rate.deltaInr !== null && rate.deltaInr < 0 ? 'text-quiet-ink' : 'text-muted-foreground')}>
                    {delta}
                  </p>
                )}
              </div>
            )}
          </div>
          {ratio !== null && (
            <div className="mt-3">
              <Meter value={ratio} tone={ratio < 1 ? 'quiet' : 'ink'} className="h-1.5" />
              <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-subtle-foreground">
                <span>{rate.offeredInr !== null ? formatInr(rate.offeredInr) : 'No offer'}</span>
                <span>{rate.rateInr ? formatInr(rate.rateInr) : ''}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Terms */}
      <section>
        <SectionHeading title="The terms" aside={deal.emails.length > 1 ? 'Latest across the thread' : undefined} />
        <dl className="rounded-[13px] border border-border-muted px-3.5 py-1.5">
          <Property label="Deliverables">
            {deal.terms.deliverables.length ? deliverableText(deal.terms.deliverables) : <Empty>Not stated</Empty>}
          </Property>
          <Property label="Platform">{platformLabel(deal.terms.platform)}</Property>
          <Property label="Deadline">
            <span className={cx(due.late && 'text-destructive')}>
              {deal.terms.deadline.date ? `${due.date} · ${due.suffix}` : deal.terms.deadline.relative ?? <Empty>Not stated</Empty>}
            </span>
            {deal.terms.deadline.raw && <span className="block text-[11px] text-subtle-foreground">“{deal.terms.deadline.raw}”</span>}
          </Property>
          <Property label="Usage">
            {usage ?? <Empty>Not stated</Empty>}
          </Property>
          <Property label="Contact">{deal.terms.contactName ?? <Empty>Not named</Empty>}</Property>
          {deal.terms.notes.length > 0 && (
            <Property label="Worth noting">
              <ul className="space-y-0.5">
                {deal.terms.notes.map((note) => (
                  <li key={note} className="flex gap-1.5">
                    <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-subtle-foreground" />
                    {note}
                  </li>
                ))}
              </ul>
            </Property>
          )}
        </dl>
      </section>

      {/* Risks */}
      <section>
        <SectionHeading
          title="What to watch"
          aside={
            risks.length ? (
              <RiskBadge risks={deal.risks} score={deal.riskScore} />
            ) : undefined
          }
        />
        {risks.length ? (
          <ul className="overflow-hidden rounded-[13px] bg-muted shadow-sunk">
            {risks.map((risk, i) => {
              const meta = SEVERITY_META[risk.severity]
              return (
                <li key={risk.code} className={cx('px-3.5 py-3', i > 0 && 'border-t border-border')}>
                  <div className="flex items-start gap-2.5">
                    <span aria-hidden className={cx('mt-[6px] size-1.5 shrink-0 rounded-full', meta.dot)} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium">
                        {risk.title}
                        <span className={cx('text-[10.5px] font-medium', meta.text)}>{meta.label}</span>
                      </p>
                      <p className="mt-0.5 text-[12px] leading-[17px] text-muted-foreground">{risk.why}</p>
                      {risk.evidence && (
                        <p className="mt-1 rounded-[6px] bg-[rgb(var(--shade)/0.04)] px-1.5 py-1 font-mono text-[10.5px] leading-4 text-subtle-foreground">
                          {risk.evidence}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rounded-[13px] bg-muted px-3.5 py-3 text-[12.5px] text-muted-foreground shadow-sunk">
            Nothing this desk can flag: the fee clears your rate, the rules are clear, and the terms are complete.
          </p>
        )}
      </section>

      {/* Thread */}
      <section>
        <SectionHeading title="The thread" aside={`${deal.emails.length} ${deal.emails.length === 1 ? 'email' : 'emails'}`} />
        <ul className="overflow-hidden rounded-[13px] border border-border-muted">
          {[...deal.emails].reverse().map((email, i) => (
            <li key={email.id} className={cx(i > 0 && 'border-t border-border-muted')}>
              <button
                type="button"
                onClick={() => onOpenEmail(email)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <Mail aria-hidden className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[12.5px] font-medium">{email.subject}</span>
                    {i === 0 && (
                      <span className="shrink-0 rounded-[5px] bg-accent px-1 text-[10px] font-medium text-muted-foreground">Latest</span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                    {email.from} · {receivedLabel(email.receivedAt)}
                  </span>
                </span>
                <CornerDownRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Draft */}
      <section>
        <SectionHeading
          title="Draft reply"
          aside={
            deal.draft ? (
              <span className="rounded-[5px] bg-accent px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">{deal.draft.language}</span>
            ) : undefined
          }
        />
        {deal.draft ? (
          <div className="overflow-hidden rounded-[13px] bg-card shadow-raised">
            <div className="flex items-start gap-2 border-b border-border-muted px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium">{deal.draft.subject}</p>
                <p className="mt-0.5 text-[11.5px] leading-4 text-muted-foreground">{deal.draft.note}</p>
              </div>
              <CopyButton
                text={`Subject: ${deal.draft.subject}\n\n${deal.draft.body}`}
                onCopy={() => onCopy('Draft copied. Nothing has been sent.')}
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto px-3.5 py-3" data-scrollbar>
              <p className="text-[12.5px] leading-[19px] whitespace-pre-wrap text-secondary-foreground">{deal.draft.body}</p>
            </div>
            <p className="flex items-center gap-1.5 border-t border-border-muted px-3.5 py-2 text-[10.5px] text-subtle-foreground">
              <ShieldAlert aria-hidden className="size-3" />
              Reviewed draft. Winnow never sends, and never writes to the brand.
            </p>
          </div>
        ) : (
          <Callout icon={<ShieldAlert />} tone={deal.action === 'report' ? 'danger' : 'neutral'}>
            {deal.action === 'report'
              ? 'No reply is drafted on purpose. Replying confirms the address is live; report it instead.'
              : 'No reply is drafted on purpose. This one does not need an answer.'}
          </Callout>
        )}
      </section>

      {/* Audit */}
      <details className="group rounded-[11px] border border-border-muted px-3.5 py-2.5">
        <summary className="cursor-pointer text-[12px] font-medium text-muted-foreground marker:content-['']">
          Why this category · {CATEGORY_META[deal.category].label}
        </summary>
        <p className="mt-1.5 text-[12px] leading-[17px] text-secondary-foreground">{deal.categoryReason}</p>
        {deal.emails.some((e) => e.matches.length) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {[...new Set(deal.emails.flatMap((e) => e.matches))].map((match) => (
              <span key={match} className="rounded-[5px] bg-accent px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {match}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-subtle-foreground">Latest email: {latest.id} · risk {deal.riskScore}/100</p>
      </details>
    </div>
  )
}

function CopyButton({ text, onCopy }: { text: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant={copied ? 'quiet' : 'secondary'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          onCopy()
          setTimeout(() => setCopied(false), 1800)
        } catch {
          onCopy()
        }
      }}
      className="shrink-0"
    >
      {copied ? <Check /> : <Clipboard />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}
