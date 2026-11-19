import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { providerFromEnv } from '../llm/provider'
import { RecordedLlm, type Mode } from '../llm/recordings'
import { EmailSchema, ProfileSchema, type Email, type Profile } from '../types'

export function loadEnv() {
  if (existsSync('.env')) process.loadEnvFile('.env')
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

export function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

export function loadInputs(inboxPath: string, profilePath: string): { emails: Email[]; profile: Profile } {
  return {
    emails: z.array(EmailSchema).parse(JSON.parse(readFileSync(inboxPath, 'utf8'))),
    profile: ProfileSchema.parse(JSON.parse(readFileSync(profilePath, 'utf8'))),
  }
}

/** Replay by default. `--live` fills gaps from the configured provider; `--fresh` ignores recordings. */
export function openLlm(recordingsPath: string | null): RecordedLlm {
  const mode: Mode = flag('fresh') ? 'fresh' : flag('live') ? 'live' : 'replay'
  return new RecordedLlm(recordingsPath, mode, mode === 'replay' ? null : providerFromEnv())
}
