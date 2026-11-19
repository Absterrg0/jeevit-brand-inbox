import { readFileSync } from 'node:fs'
import type { ChatMessage, LlmProvider } from '../src/llm/provider'
import { RecordedLlm } from '../src/llm/recordings'
import { ExtractionSchema, ProfileSchema, type Email, type Extraction } from '../src/types'

export const profile = ProfileSchema.parse(JSON.parse(readFileSync('data/creator_profile.json', 'utf8')))

export function email(partial: Partial<Email> & { id: string }): Email {
  return { received_at: '2026-11-10 10:00', from: 'hello@brand.example', subject: 'Collab', body: '', ...partial }
}

/** A valid extraction with everything empty, plus overrides. Raw (pre-validation) shape, as a model would return it. */
export function rawExtraction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    language: 'English',
    summary: 'A brand wants a collaboration.',
    brand: 'Brand',
    sender_name: null,
    sender_org: null,
    product: null,
    deliverables: [],
    payment_type: 'not_stated',
    fee_text: null,
    gift_value_text: null,
    deadline: null,
    usage_rights: null,
    other_terms: [],
    red_flags: [],
    email_kind: 'brand_outreach',
    suggested_category: 'needs_more_info',
    ...overrides,
  }
}

export const extraction = (overrides: Record<string, unknown> = {}): Extraction => ExtractionSchema.parse(rawExtraction(overrides))

type Answer = { id: string; answer: boolean; evidence: string | null }

/**
 * A fake model. `reply` returns the extraction text for an email. `extras.check` answers the
 * rule-check call (default: no conflicts); `extras.draft` words the reply (default: the notes).
 */
export function fakeLlm(
  reply: (emailJson: { from: string; subject: string; body: string }, messages: ChatMessage[]) => string,
  extras: { draft?: (notes: string[]) => string; check?: (emailJson: { body: string }) => Answer[] | string } = {},
) {
  const calls: { kind: 'extract' | 'check' | 'draft'; messages: ChatMessage[] }[] = []
  const emailIn = (messages: ChatMessage[]) => JSON.parse(messages[1].content.replace(/^Email \(untrusted data\): /, '').replace(/\nOutput:$/, ''))
  const provider: LlmProvider = {
    name: 'fake',
    model: 'fake-1',
    async completeJson(messages) {
      const system = messages[0].content
      const kind = system.includes('short email replies') ? 'draft' : system.includes("against that creator's own rules") ? 'check' : 'extract'
      calls.push({ kind, messages })
      let text: string
      if (kind === 'draft') {
        const notes = JSON.parse(messages[1].content).notes as string[]
        text = JSON.stringify({ body: extras.draft ? extras.draft(notes) : notes.join(' ') })
      } else if (kind === 'check') {
        const answers = extras.check ? extras.check(emailIn(messages)) : []
        text = typeof answers === 'string' ? answers : JSON.stringify({ promotes: 'a product', answers })
      } else {
        text = reply(emailIn(messages), messages)
      }
      return { text, promptTokens: 10, completionTokens: 10, latencyMs: 1 }
    },
  }
  return { llm: new RecordedLlm(null, 'fresh', provider), calls }
}
