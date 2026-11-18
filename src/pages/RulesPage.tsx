import { AtSign, BadgeCheck, CalendarClock, Globe2, Languages, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import type { Analysis } from '../engine/types'
import { cx } from '../lib/cx'
import { daysBetween, formatInr, longDate, plural } from '../lib/format'
import { PageHeader, PageSurface, SectionHeading } from '../components/Page'
import { Avatar, Property } from '../components/ui/primitives'

const RATE_LABELS: Record<string, string> = {
  instagram_reel: 'Instagram reel',
  instagram_story: 'Instagram story',
  youtube_integration: 'YouTube integration',
  youtube_dedicated_video: 'YouTube dedicated video',
}

const STEPS = [
  { n: '01', title: 'Scam and phishing first', body: 'Pay-to-join, fake domains, urgency and instructions aimed at an assistant stop here. No fee is worth a reply.' },
  { n: '02', title: 'Hard rules next', body: 'Exclusivity and content rules outrank money. A ₹3 L gambling offer loses to a standing no, without a counter.' },
  { n: '03', title: 'Missing terms before yes', body: 'No fee, deliverables, date or usage means ask — even when the brand sounds perfect.' },
  { n: '04', title: 'Money against your card', body: 'The latest fee is compared with your rate for the same deliverables, converting USD at ₹84. Under rate means counter or ask, not accept.' },
  { n: '05', title: 'Rights and timing', body: 'Usage beyond 3 months is priced, never given. A date that has passed is a question, not a deadline.' },
]

export function RulesPage({ analysis }: { analysis: Analysis }) {
  const profile = analysis.profile
  const exclusivity = profile.current_exclusivity[0]
  const daysLeft = exclusivity ? daysBetween(analysis.today, exclusivity.until) : 0

  return (
    <PageSurface>
      <PageHeader title="Rules" count="The line the desk holds" />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8" data-scrollbar>
        <div className="mx-auto max-w-[980px] space-y-5 pt-1">
          <section className="rounded-[14px] bg-card p-4 shadow-raised">
            <div className="flex flex-wrap items-center gap-3.5">
              <Avatar className="size-11 text-[14px]" initials="RM" />
              <div className="min-w-0">
                <h2 className="flex items-center gap-1.5 text-[17px] font-semibold tracking-[-0.02em]">
                  {profile.name}
                  <BadgeCheck aria-hidden className="size-4 text-label-blue" />
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {profile.niche} · {profile.email}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
                {profile.platforms.instagram && (
                  <span className="flex items-center gap-1.5">
                    <AtSign aria-hidden className="size-3.5" />
                    <span className="text-foreground">{profile.platforms.instagram.followers.toLocaleString('en-IN')}</span>
                    on Instagram
                  </span>
                )}
                {profile.platforms.youtube && (
                  <span className="flex items-center gap-1.5">
                    <Globe2 aria-hidden className="size-3.5" />
                    <span className="text-foreground">{profile.platforms.youtube.subscribers.toLocaleString('en-IN')}</span>
                    on YouTube
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Languages aria-hidden className="size-3.5" />
                  {profile.languages.join(' + ')}
                </span>
              </div>
            </div>
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-[14px] border border-border-muted p-4">
              <SectionHeading title="Rate card" aside={profile.currency_note} />
              <dl className="divide-y divide-border-muted">
                {Object.entries(profile.base_rates_inr).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-3 py-2.5">
                    <dt className="min-w-0 flex-1 text-[12.5px] text-secondary-foreground">{RATE_LABELS[key] ?? key.replaceAll('_', ' ')}</dt>
                    <dd className="text-[14px] font-medium tabular-nums">{formatInr(value)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 border-t border-border-muted pt-2 text-[11px] leading-4 text-subtle-foreground">
                No separate shoutout rate: a YouTube shoutout is priced as an integration, the closest card entry. That proxy is flagged on the deal.
              </p>
            </section>

            <div className="space-y-4">
              <section className="rounded-[14px] bg-quiet-soft p-4 shadow-[inset_0_1px_2px_rgb(168_90_6/0.08),inset_0_0_0_1px_rgb(217_138_28/0.2)]">
                <div className="flex items-center gap-2">
                  <Lock aria-hidden className="size-3.5 text-quiet-ink" />
                  <h2 className="text-[12.5px] font-medium text-quiet-ink">Exclusivity, still live</h2>
                  <span className="ml-auto text-[11px] text-quiet-ink/80 tabular-nums">{daysLeft} days left</span>
                </div>
                {exclusivity ? (
                  <>
                    <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold text-quiet-ink">
                      {exclusivity.brand}
                      <span className="text-[11.5px] font-normal opacity-80">/ {exclusivity.category}</span>
                    </p>
                    <p className="mt-1 text-[12px] leading-[18px] text-quiet-ink/90">{exclusivity.terms}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-quiet-ink/80">
                      <CalendarClock aria-hidden className="size-3" />
                      Until {longDate(exclusivity.until)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[12px] text-quiet-ink">No active exclusivity.</p>
                )}
              </section>

              <section className="rounded-[14px] border border-border-muted p-4">
                <SectionHeading title="Usage rights" />
                <p className="text-[12.5px] leading-[19px] text-secondary-foreground">{profile.usage_rights_policy}</p>
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-subtle-foreground">
                  <Sparkles aria-hidden className="mt-px size-3 shrink-0" />
                  AuralBuds is the test case: perpetual usage and whitelisting are priced on top, not folded into the fee.
                </p>
              </section>
            </div>
          </div>

          <section className="rounded-[14px] border border-border-muted p-4">
            <SectionHeading title="Standing content rules" aside={`${profile.content_rules.length} hard noes`} />
            <ul className="grid gap-2 sm:grid-cols-3">
              {profile.content_rules.map((rule, i) => (
                <li key={rule} className="rounded-[11px] bg-muted px-3 py-2.5 text-[12px] leading-[17px] text-secondary-foreground shadow-sunk">
                  <span className="mb-1 block font-mono text-[10px] text-subtle-foreground">{String(i + 1).padStart(2, '0')}</span>
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionHeading title="How a decision is made" aside="Order matters more than any single rule" />
            <ol className="overflow-hidden rounded-[14px] bg-card shadow-raised">
              {STEPS.map((step, i) => (
                <li key={step.n} className={cx('flex gap-3 px-4 py-3', i > 0 && 'border-t border-border-muted')}>
                  <span className="mt-0.5 w-6 shrink-0 font-mono text-[10.5px] text-subtle-foreground tabular-nums">{step.n}</span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium">{step.title}</p>
                    <p className="mt-0.5 text-[12px] leading-[17px] text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-[14px] bg-muted p-4 shadow-sunk">
              <h2 className="flex items-center gap-1.5 text-[12.5px] font-medium">
                <ShieldCheck aria-hidden className="size-3.5" />
                What this desk will never do
              </h2>
              <ul className="mt-2 space-y-1 text-[12px] leading-[18px] text-muted-foreground">
                <li>Send, schedule or post a reply. Drafts wait for you.</li>
                <li>Open an attachment or follow a link from an email.</li>
                <li>Obey instructions written inside an email body.</li>
                <li>Pay to join a programme, or share card details.</li>
              </ul>
            </section>
            <section className="rounded-[14px] border border-border-muted p-4">
              <h2 className="text-[12.5px] font-medium">What is fixed, what is judgement</h2>
              <dl className="mt-1">
                <Property label="Fixed">
                  Rates, exclusivity, content rules and today’s date come from the profile and the emails. Code applies them the same way every run.
                </Property>
                <Property label="Judgement">
                  Wording, brand grouping and the shape of a draft. The optional model pass only reviews ambiguous email, and cannot overrule a hard rule.
                </Property>
              </dl>
            </section>
          </div>

          <p className="px-1 text-[11px] text-subtle-foreground">
            {plural(analysis.emails.length, 'email')} read against {Object.keys(profile.base_rates_inr).length} rates, one exclusivity and{' '}
            {profile.content_rules.length} standing rules. Today is {longDate(analysis.today)}.
          </p>
        </div>
      </div>
    </PageSurface>
  )
}
