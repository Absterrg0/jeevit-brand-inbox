import { ArrowUpRight, FileText, MessageSquare, ShieldAlert } from 'lucide-react'
import type { Deal, EmailAnalysis } from '../engine/types'
import { deliverableText } from '../engine/assess'
import { cx } from '../lib/cx'
import { deadlineLabel, money, moneyNote, platformLabel, receivedLabel, receivedTime, usageText } from '../lib/format'
import { ACTION_META, CATEGORY_META } from '../lib/meta'
import { Button } from './ui/Button'
import { Callout, SectionHeading } from './Page'
import { ActionChip, BrandTile, CategoryChip, Empty, Property } from './ui/primitives'

export const emailHeader = (email: EmailAnalysis) => <BrandTile name={email.brand} size="lg" />

export function EmailSheetBody({
  email,
  deal,
  today,
  onOpenDeal,
}: {
  email: EmailAnalysis
  deal: Deal | undefined
  today: string
  onOpenDeal: () => void
}) {
  const fee = email.fee
  const usage = usageText(email.usage)
  const due = deadlineLabel(email.deadline, today)
  const urgent = email.category === 'scam_or_phishing'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryChip category={email.category} />
        <span className="text-[11.5px] text-muted-foreground">
          {receivedLabel(email.receivedAt)} · {receivedTime(email.receivedAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[11px] bg-muted px-3 py-2 text-[12px] shadow-sunk">
        <span className="min-w-0 truncate text-secondary-foreground">{email.from}</span>
        {deal && (
          <button
            type="button"
            onClick={onOpenDeal}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-[7px] px-1.5 py-0.5 font-medium text-foreground hover:bg-accent"
          >
            <MessageSquare aria-hidden className="size-3" />
            {deal.brand} deal
            <ArrowUpRight aria-hidden className="size-3" />
          </button>
        )}
      </div>

      {email.injection && (
        <Callout icon={<ShieldAlert />} tone="danger" title="Written to instruct an AI assistant">
          The body contains directions meant for a model, not for you. They were treated as text and never followed.
        </Callout>
      )}

      {urgent && (
        <Callout icon={<ShieldAlert />} tone="danger" title="Do not reply, click, or pay">
          {email.categoryReason}
        </Callout>
      )}

      <section>
        <SectionHeading title="The email" aside={<span className="inline-flex items-center gap-1"><FileText className="size-3" /> Plain text, as received</span>} />
        <div className="rounded-[13px] border border-border-muted bg-muted/60 px-4 py-3.5">
          <p className="text-[12.5px] leading-[20px] whitespace-pre-wrap text-secondary-foreground">{email.body}</p>
        </div>
      </section>

      <section>
        <SectionHeading title="What it says" />
        <dl className="rounded-[13px] border border-border-muted px-3.5 py-1.5">
          <Property label="Fee">
            {fee ? (
              <>
                {money(fee)}
                {moneyNote(fee) && <span className="ml-1.5 text-[11px] text-subtle-foreground">{moneyNote(fee)}</span>}
              </>
            ) : (
              <Empty>Not stated</Empty>
            )}
          </Property>
          <Property label="Deliverables">{email.deliverables.length ? deliverableText(email.deliverables) : <Empty>Not stated</Empty>}</Property>
          <Property label="Platform">{platformLabel(email.platform)}</Property>
          <Property label="Deadline">
            {email.deadline.date ? (
              <span className={cx(due.late && 'text-destructive')}>
                {due.date} · {due.suffix}
              </span>
            ) : (
              email.deadline.relative ?? <Empty>Not stated</Empty>
            )}
          </Property>
          <Property label="Usage">{usage ?? <Empty>Not stated</Empty>}</Property>
          {email.notes.length > 0 && (
            <Property label="Notes">
              <ul className="space-y-0.5">
                {email.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Property>
          )}
        </dl>
      </section>

      <section>
        <SectionHeading title="How it was read" />
        <p className="rounded-[13px] bg-muted px-3.5 py-3 text-[12px] leading-[18px] text-secondary-foreground shadow-sunk">
          {email.categoryReason}
        </p>
        {email.matches.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {email.matches.map((match) => (
              <span key={match} className="rounded-[5px] bg-accent px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {match}
              </span>
            ))}
          </div>
        )}
      </section>

      {deal && (
        <section>
          <SectionHeading title="The deal so far" aside={`${deal.emails.length} ${deal.emails.length === 1 ? 'email' : 'emails'}`} />
          <button
            type="button"
            onClick={onOpenDeal}
            className="flex w-full items-center gap-2.5 rounded-[13px] bg-card px-3.5 py-3 text-left shadow-raised transition-shadow hover:shadow-raised-hover"
          >
            <BrandTile name={deal.brand} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{deal.brand}</span>
              <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{deal.summary}</span>
            </span>
            <ActionChip action={deal.action} />
            <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-subtle-foreground" />
          </button>
          <p className="mt-1.5 px-1 text-[11px] text-subtle-foreground">
            {CATEGORY_META[deal.category].label} · {ACTION_META[deal.action].label} recommended
          </p>
        </section>
      )}

      <p className="border-t border-border-muted pt-3 text-[10.5px] leading-4 text-subtle-foreground">
        Email content is untrusted. It is parsed as data, never executed, and no links are opened from this desk.
      </p>
    </div>
  )
}

export function EmailFooter({ onOpenDeal }: { onOpenDeal?: () => void }) {
  return (
    <>
      <span className="mr-auto text-[11px] text-subtle-foreground">Read-only view</span>
      {onOpenDeal && (
        <Button size="sm" onClick={onOpenDeal}>
          Open deal
          <ArrowUpRight />
        </Button>
      )}
    </>
  )
}
