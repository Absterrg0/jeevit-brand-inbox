/**
 * Model call 2 of 2: word the reply.
 *
 * By this point the code has already chosen the action and written the points
 * the reply must make (core/policy.ts). The model turns those points into a
 * short email in the sender's language. It is never shown the original email,
 * only the brand name, the contact's first name and the points, so an email
 * cannot talk the drafter into anything. The result still has to pass
 * draftProblems(); if it fails twice, the template is used instead.
 */
import { draftProblems, templateDraft } from '../core/draftGuard'
import { DraftSchema, type Action } from '../types'
import type { ChatMessage } from './provider'
import type { RecordedLlm } from './recordings'

export const DRAFT_PROMPT_VERSION = 'draft-v1'

const GOAL: Partial<Record<Action, string>> = {
  accept: 'accept the offer and ask for the agreement',
  negotiate: 'negotiate politely and firmly',
  ask_for_details: 'ask for the missing details',
  decline: 'decline politely',
}

export interface DraftRequest {
  label: string
  action: Action
  brand: string
  contactName: string | null
  language: string
  signature: string
  points: string[]
}

export function draftMessages(request: DraftRequest): ChatMessage[] {
  const system = `You write short email replies for a content creator. You are given notes; turn them into the email.

Rules:
- Say everything in the notes and nothing else. Do not add facts, prices, dates, promises, links, phone numbers or addresses.
- Keep every amount and date exactly as written in the notes.
- Under 120 words. Warm, direct, professional. No subject line.
- Write in the language named in "language". For "Hinglish", write Hindi in Latin letters the way the sender would.
- Start with a greeting to "to" if a name is given, and sign off as the name in "from".
- Return JSON: {"body": "<the email>"}`
  const user = JSON.stringify({
    goal: GOAL[request.action],
    language: request.language,
    to: request.contactName,
    brand: request.brand,
    from: request.signature,
    notes: request.points,
  })
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export async function writeDraft(llm: RecordedLlm, request: DraftRequest): Promise<{ body: string; source: 'model' | 'template' }> {
  const fallback = { body: templateDraft({ greetingName: request.contactName, points: request.points, signature: request.signature }), source: 'template' as const }
  const messages = draftMessages(request)
  try {
    let conversation = messages
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await llm.complete(DRAFT_PROMPT_VERSION, `${request.label}${attempt ? ' (retry)' : ''}`, conversation, { maxTokens: 500 })
      let problems: string[]
      let body = ''
      try {
        body = DraftSchema.parse(JSON.parse(response.text)).body
        problems = draftProblems(body, request.points)
      } catch {
        problems = ['was not the JSON object {"body": "..."}']
      }
      if (!problems.length) return { body, source: 'model' }
      if (attempt === 0) llm.log.retries += 1
      conversation = [...messages, { role: 'assistant', content: response.text.slice(0, 3000) }, { role: 'user', content: `That draft ${problems.slice(0, 3).join('; ')}. Rewrite it using only the notes. Return JSON {"body": "..."}.` }]
    }
    return fallback
  } catch {
    // No recording, no provider, or the call failed: the creator still gets a usable draft.
    return fallback
  }
}
