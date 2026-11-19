/**
 * Recorded model responses, so a fresh clone runs without a key.
 *
 * Each entry is keyed by a hash of the prompt version and the exact messages
 * sent. Change an email or a prompt and the key changes, so a stale recording
 * can never be replayed against new input.
 *
 *   replay (default)  recorded responses only; a miss is reported, not guessed
 *   live              use the recording if there is one, otherwise call the model and save it
 *   fresh             always call the model (used to measure run-to-run variance)
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ChatMessage, LlmProvider, LlmResponse } from './provider'

export type Mode = 'replay' | 'live' | 'fresh'

interface Entry extends LlmResponse {
  label: string
  provider: string
  model: string
}

export class RecordingMissError extends Error {}

export interface CallLog {
  calls: number
  retries: number
  failures: number
  promptTokens: number
  completionTokens: number
  recordedLatencyMs: number
  providers: Set<string>
  models: Set<string>
}

export const newCallLog = (): CallLog => ({ calls: 0, retries: 0, failures: 0, promptTokens: 0, completionTokens: 0, recordedLatencyMs: 0, providers: new Set(), models: new Set() })

export class RecordedLlm {
  private entries: Record<string, Entry> = {}
  private used = new Set<string>()
  readonly log = newCallLog()

  constructor(
    private file: string | null,
    readonly mode: Mode,
    private provider: LlmProvider | null,
  ) {
    if (file && existsSync(file) && mode !== 'fresh') this.entries = JSON.parse(readFileSync(file, 'utf8')).entries ?? {}
  }

  static key(promptVersion: string, messages: ChatMessage[]): string {
    return createHash('sha256').update(promptVersion).update(JSON.stringify(messages)).digest('hex').slice(0, 20)
  }

  async complete(promptVersion: string, label: string, messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LlmResponse> {
    const key = RecordedLlm.key(promptVersion, messages)
    let entry = this.mode === 'fresh' ? undefined : this.entries[key]
    if (!entry) {
      if (this.mode === 'replay' || !this.provider) {
        throw new RecordingMissError(`No recorded response for ${label}. The email or the prompt changed since the recording; run with --live and a provider configured.`)
      }
      const response = await this.provider.completeJson(messages, options)
      entry = { label, provider: this.provider.name, model: this.provider.model, ...response }
      this.entries[key] = entry
      this.save()
    }
    this.used.add(key)
    this.log.calls += 1
    this.log.promptTokens += entry.promptTokens
    this.log.completionTokens += entry.completionTokens
    this.log.recordedLatencyMs += entry.latencyMs
    this.log.providers.add(entry.provider)
    this.log.models.add(entry.model)
    return entry
  }

  /** Drop recordings this run did not use (left over from older prompts), then save. */
  prune() {
    this.entries = Object.fromEntries(Object.entries(this.entries).filter(([key]) => this.used.has(key)))
    this.save()
  }

  private save() {
    if (!this.file || this.mode === 'fresh') return
    mkdirSync(dirname(this.file), { recursive: true })
    const sorted = Object.fromEntries(Object.entries(this.entries).sort(([, a], [, b]) => a.label.localeCompare(b.label)))
    writeFileSync(this.file, `${JSON.stringify({ note: 'Recorded LLM responses. Regenerate with: npm run analyze -- --live', entries: sorted }, null, 1)}\n`)
  }
}
