import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../engine/types'

export type Page = 'today' | 'deals' | 'inbox' | 'rules' | 'evaluation'
export type View = 'table' | 'board'

export interface ViewState {
  page: Page
  view: View
  dealId: string | null
  emailId: string | null
  q: string
  category: Category | 'all'
  riskOnly: boolean
}

const PAGES: Page[] = ['today', 'deals', 'inbox', 'rules', 'evaluation']
const CATEGORIES: (Category | 'all')[] = ['all', 'deal_offer', 'needs_more_info', 'not_a_fit', 'scam_or_phishing', 'spam']

function read(): ViewState {
  const p = new URLSearchParams(window.location.search)
  const page = PAGES.find((x) => x === p.get('page')) ?? 'today'
  return {
    page,
    view: p.get('view') === 'board' ? 'board' : 'table',
    dealId: p.get('deal'),
    emailId: p.get('email'),
    q: p.get('q') ?? '',
    category: CATEGORIES.find((x) => x === p.get('cat')) ?? 'all',
    riskOnly: p.get('risk') === '1',
  }
}

export function useUrlState() {
  const [state, setState] = useState<ViewState>(read)

  useEffect(() => {
    const onPop = () => setState(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const update = useCallback(
    (patch: Partial<ViewState>, push = false) => {
      setState((prev) => {
        const next = { ...prev, ...patch }
        const params = new URLSearchParams()
        if (next.page !== 'today') params.set('page', next.page)
        if (next.view !== 'table') params.set('view', next.view)
        if (next.dealId) params.set('deal', next.dealId)
        if (next.emailId) params.set('email', next.emailId)
        if (next.q) params.set('q', next.q)
        if (next.category !== 'all') params.set('cat', next.category)
        if (next.riskOnly) params.set('risk', '1')
        const url = `${window.location.pathname}${params.size ? `?${params}` : ''}`
        if (push) window.history.pushState(null, '', url)
        else window.history.replaceState(null, '', url)
        return next
      })
    },
    [],
  )

  const navigate = useCallback(
    (page: Page) => update({ page, dealId: null, emailId: null, q: '', category: 'all', riskOnly: false }, true),
    [update],
  )

  return { state, update, navigate }
}
