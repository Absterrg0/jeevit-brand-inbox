/**
 * One small interface over any OpenAI-compatible chat endpoint. Groq,
 * OpenRouter and Gemini's compatibility endpoint all speak it, so switching
 * provider is configuration, not code.
 *
 * The model is called with JSON mode and nothing else: no tools, no function
 * calling, no browsing. The only thing it can do is return text.
 */

import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmResponse {
  text: string
  promptTokens: number
  completionTokens: number
  latencyMs: number
}

export interface LlmProvider {
  name: string
  model: string
  completeJson(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LlmResponse>
}

interface Preset {
  baseUrl: string
  keyEnv: string
  defaultModel: string
}

/** Default models are free-tier ones at the time of writing; override with LLM_MODEL. */
export const PRESETS: Record<string, Preset> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', defaultModel: 'openai/gpt-oss-120b' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyEnv: 'GEMINI_API_KEY', defaultModel: 'gemini-2.5-flash' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free' },
  // Local model, opt-in only (LLM_PROVIDER=ollama); never picked automatically. No key needed.
  ollama: { baseUrl: 'http://localhost:11434/v1', keyEnv: '', defaultModel: 'qwen2.5:7b' },
}

/** LLM_PROVIDER if set, else the first provider with a key. No key is an error, never a silent fallback. */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const name = env.LLM_PROVIDER ?? Object.keys(PRESETS).find((p) => PRESETS[p].keyEnv && env[PRESETS[p].keyEnv])
  if (!name) throw new Error(`No model configured. Copy .env.example to .env and set one of ${Object.values(PRESETS).map((p) => p.keyEnv).filter(Boolean).join(', ')}, or set LLM_PROVIDER=ollama for a local model.`)
  const preset = PRESETS[name]
  if (!preset) throw new Error(`Unknown LLM_PROVIDER "${name}". Use one of: ${Object.keys(PRESETS).join(', ')}.`)
  const apiKey = preset.keyEnv ? env[preset.keyEnv] : 'ollama'
  if (!apiKey) throw new Error(`LLM_PROVIDER=${name} needs ${preset.keyEnv}. Copy .env.example to .env and set it.`)
  return openAiCompatible({
    name,
    baseUrl: env.LLM_BASE_URL ?? preset.baseUrl,
    apiKey,
    model: env.LLM_MODEL ?? preset.defaultModel,
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? (name === 'ollama' ? 600_000 : 60_000)),
  })
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly network = false,
    readonly retryAfterS?: number,
  ) {
    super(message)
  }
}

/** POST JSON with node:http(s), so the timeout is the one we pass and the retry-after header is readable. */
function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number, name: string): Promise<unknown> {
  const payload = JSON.stringify(body)
  const send = url.startsWith('https:') ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    const req = send(url, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers } }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        const status = res.statusCode ?? 0
        if (status < 200 || status >= 300) return reject(new HttpError(`${name} returned HTTP ${status}: ${text.slice(0, 200)}`, status, false, Number(res.headers['retry-after']) || undefined))
        try {
          resolve(JSON.parse(text))
        } catch {
          reject(new HttpError(`${name} returned a body that is not JSON`, status))
        }
      })
    })
    req.setTimeout(timeoutMs, () => req.destroy(new HttpError(`${name} did not answer within ${Math.round(timeoutMs / 1000)} s`, undefined, true)))
    req.on('error', (e) => reject(e instanceof HttpError ? e : new HttpError(`${name} request failed: ${e.message}`, undefined, true)))
    req.end(payload)
  })
}

export function openAiCompatible(config: { name: string; baseUrl: string; apiKey: string; model: string; timeoutMs: number }): LlmProvider {
  // Reasoning models spend completion tokens thinking before they answer, so the caller's cap (sized for the
  // answer alone) would cut the JSON off. Keep the thinking short and give it its own headroom.
  const reasoning = /gpt-oss|deepseek-r1/.test(config.model)

  async function once(messages: ChatMessage[], options: { temperature?: number; maxTokens?: number }) {
    const started = Date.now()
    const data = (await postJson(
      `${config.baseUrl}/chat/completions`,
      { authorization: `Bearer ${config.apiKey}` },
      {
        model: config.model,
        messages,
        temperature: options.temperature ?? 0,
        max_tokens: (options.maxTokens ?? 900) + (reasoning ? 1500 : 0),
        ...(reasoning && config.name === 'groq' ? { reasoning_effort: 'low' } : {}),
        response_format: { type: 'json_object' },
      },
      config.timeoutMs,
      config.name,
    )) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    }
  }

  return {
    name: config.name,
    model: config.model,
    async completeJson(messages, options = {}) {
      // Patient retries for rate limits (honouring retry-after, as free tiers throttle per minute), transient
      // server errors and dropped connections; anything else is the caller's problem.
      for (let attempt = 0; ; attempt++) {
        try {
          return await once(messages, options)
        } catch (error) {
          const { status, network, retryAfterS } = error as { status?: number; network?: boolean; retryAfterS?: number }
          const rateLimited = status === 429
          if (!network && !rateLimited && !(status && status >= 500)) throw error
          if (attempt >= (rateLimited ? 8 : 1)) throw error
          // A wait this long means a daily quota, not a per-minute one: fail now rather than hang.
          if (retryAfterS && retryAfterS > 120) throw error
          await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, (retryAfterS ?? 5) * 1000 + 500)))
        }
      }
    },
  }
}
