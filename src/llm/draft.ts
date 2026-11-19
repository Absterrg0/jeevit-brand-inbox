/**
 * Model call 3 of 3: word the reply.
 *
 * By this point the code has already chosen the action and written the points
 * the reply must make (core/policy.ts). The model turns those points into a
 * short email body in the sender's language. It is never shown the original
 * email or any name from it, only the points, so an email cannot talk the
 * drafter into anything. Greeting and sign-off are added by code. The result still has to pass
 * draftProblems(); if it fails twice, the template is used instead.
 */
import { draftProblems, templateDraft, wrapDraft } from '../core/draftGuard'
import { DraftSchema, type Action } from '../types'
import type { ChatMessage } from './provider'
import type { RecordedLlm } from './recordings'

export const DRAFT_PROMPT_VERSION = 'draft-v2'

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
  const system = `You write short email replies for a content creator. You are given notes; turn them into the body of the email.

Rules:
- Say everything in the notes and nothing else. Do not add facts, prices, dates, promises, links, phone numbers or addresses.
- Keep every amount and date exactly as written in the notes.
- Write ONLY the middle of the email. No greeting, no sign-off, no names, no subject line. They are added separately.
- Under 100 words. Warm, direct, professional, first person.
- Write in the language named in "language". For "Hinglish", write natural Hindi in Latin letters, keeping amounts and platform names in English.
- Return JSON: {"body": "<the email body>"}`
  const user = JSON.stringify({ goal: GOAL[request.action], language: request.language, notes: request.points })
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
      if (!problems.length) return { body: wrapDraft({ greetingName: request.contactName, middle: body, signature: request.signature }), source: 'model' }
      if (attempt === 0) llm.log.retries += 1
      conversation = [...messages, { role: 'assistant', content: response.text.slice(0, 3000) }, { role: 'user', content: `That draft ${problems.slice(0, 3).join('; ')}. Rewrite it using only the notes. Return JSON {"body": "..."}.` }]
    }
    return fallback
  } catch {
    // No recording, no provider, or the call failed: the creator still gets a usable draft.
    return fallback
  }
}
