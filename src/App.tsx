import { Check } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ANALYSIS } from './engine/dataset'
import type { EmailAnalysis } from './engine/types'
import { cx } from './lib/cx'
import { DealsPage } from './pages/DealsPage'
import { EvaluationPage } from './pages/EvaluationPage'
import { InboxPage } from './pages/InboxPage'
import { RulesPage } from './pages/RulesPage'
import { TodayPage } from './pages/TodayPage'
import { MobileBar, Sidebar } from './components/Sidebar'
import { Sheet } from './components/Page'
import { DealSheetBody, dealHeader } from './components/DealSheet'
import { EmailSheetBody, EmailFooter, emailHeader } from './components/EmailSheet'
import { Button } from './components/ui/Button'
import { useTheme } from './state/theme'
import { useUrlState } from './state/useUrlState'

export default function App() {
  const { state, update, navigate } = useUrlState()
  const { theme, toggle } = useTheme()
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const deal = ANALYSIS.deals.find((d) => d.id === state.dealId) ?? null
  const email = ANALYSIS.emails.find((e) => e.id === state.emailId) ?? null
  const emailDeal = email ? ANALYSIS.deals.find((d) => d.emails.some((e) => e.id === email.id)) : undefined
  const dealIndex = deal ? ANALYSIS.deals.findIndex((d) => d.id === deal.id) : -1

  const emailList = useMemo(() => {
    if (deal) return [...deal.emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    return [...ANALYSIS.emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  }, [deal])
  const emailIndex = email ? emailList.findIndex((e) => e.id === email.id) : -1

  const openDeal = (id: string) => update({ dealId: id, emailId: null }, true)
  const openEmail = (next: EmailAnalysis) => update({ emailId: next.id }, true)
  const closeDeal = () => update({ dealId: null, emailId: null })
  const closeEmail = () => update({ emailId: null })

  const counts = {
    today: ANALYSIS.summary.attention.filter((a) => ['accept', 'negotiate', 'ask_for_details'].includes(a.action)).length,
    deals: ANALYSIS.deals.length,
    inbox: ANALYSIS.emails.length,
  }

  return (
    <div className="flex h-full flex-col xl:flex-row">
      <MobileBar page={state.page} onNavigate={navigate} theme={theme} onToggleTheme={toggle} />
      <Sidebar page={state.page} onNavigate={navigate} counts={counts} theme={theme} onToggleTheme={toggle} />

      {state.page === 'today' && <TodayPage analysis={ANALYSIS} onOpenDeal={openDeal} onNavigate={navigate} />}
      {state.page === 'deals' && <DealsPage analysis={ANALYSIS} state={state} update={update} onOpenDeal={openDeal} />}
      {state.page === 'inbox' && <InboxPage analysis={ANALYSIS} state={state} update={update} onOpenEmail={openEmail} />}
      {state.page === 'rules' && <RulesPage analysis={ANALYSIS} />}
      {state.page === 'evaluation' && <EvaluationPage analysis={ANALYSIS} />}

      {deal && (
        <Sheet
          title={deal.brand}
          kicker={
            <>
              <span className="font-mono text-[10.5px] text-subtle-foreground">{deal.id}</span>
              <span aria-hidden className="text-subtle-foreground">·</span>
              <span>{deal.emails.length} {deal.emails.length === 1 ? 'email' : 'emails'}</span>
            </>
          }
          subtitle={deal.summary}
          visual={dealHeader(deal)}
          position={{ index: dealIndex, total: ANALYSIS.deals.length }}
          onPrev={dealIndex > 0 ? () => update({ dealId: ANALYSIS.deals[dealIndex - 1].id, emailId: null }) : undefined}
          onNext={dealIndex < ANALYSIS.deals.length - 1 ? () => update({ dealId: ANALYSIS.deals[dealIndex + 1].id, emailId: null }) : undefined}
          onClose={closeDeal}
          footer={
            <>
              <span className="mr-auto flex items-center gap-1.5 text-[11px] text-subtle-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-label-green" />
                Nothing sent
              </span>
              <Button size="sm" onClick={() => openEmail(deal.emails[deal.emails.length - 1])}>
                Latest email
              </Button>
              {deal.draft && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`Subject: ${deal.draft!.subject}\n\n${deal.draft!.body}`)
                      showToast('Draft copied. Nothing has been sent.')
                    } catch {
                      showToast('Copy failed — select the draft text instead.')
                    }
                  }}
                >
                  Copy reply
                </Button>
              )}
            </>
          }
        >
          <DealSheetBody deal={deal} today={ANALYSIS.today} onOpenEmail={openEmail} onCopy={showToast} />
        </Sheet>
      )}

      {email && (
        <Sheet
          title={email.subject}
          kicker={
            <>
              <span>{email.brand}</span>
              <span aria-hidden className="text-subtle-foreground">·</span>
              <span className="font-mono text-[10.5px] text-subtle-foreground">{email.id}</span>
            </>
          }
          subtitle={email.from}
          visual={emailHeader(email)}
          depth={deal ? 2 : 1}
          position={{ index: emailIndex, total: emailList.length }}
          onPrev={emailIndex > 0 ? () => update({ emailId: emailList[emailIndex - 1].id }) : undefined}
          onNext={emailIndex < emailList.length - 1 ? () => update({ emailId: emailList[emailIndex + 1].id }) : undefined}
          onClose={closeEmail}
          footer={
            <EmailFooter
              onOpenDeal={
                emailDeal
                  ? () => update({ dealId: emailDeal.id, emailId: null })
                  : undefined
              }
            />
          }
        >
          <EmailSheetBody
            email={email}
            deal={emailDeal}
            today={ANALYSIS.today}
            onOpenDeal={() => {
              if (emailDeal) update({ dealId: emailDeal.id, emailId: null })
            }}
          />
        </Sheet>
      )}

      <div
        aria-live="polite"
        className={cx(
          'pointer-events-none fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 transition-[opacity,transform] duration-150',
          toast ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        )}
      >
        {toast && (
          <span className="flex items-center gap-2 rounded-[10px] bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground shadow-toast">
            <Check aria-hidden className="size-3.5" />
            {toast}
          </span>
        )}
      </div>
    </div>
  )
}
