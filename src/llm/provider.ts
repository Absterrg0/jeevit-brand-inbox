/**
 * One small interface over any OpenAI-compatible chat endpoint. Groq,
 * OpenRouter, Gemini's compatibility endpoint and a local Ollama all speak it,
 * so switching provider is configuration, not code.
 *
 * The model is called with JSON mode and nothing else: no tools, no function
 * calling, no browsing. The only thing it can do is return text.
 */

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
  keyEnv: string | null
  defaultModel: string
}

/** Default models are free-tier ones at the time of writing; override with LLM_MODEL. */
export const PRESETS: Record<string, Preset> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', defaultModel: 'llama-3.3-70b-versatile' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyEnv: 'GEMINI_API_KEY', defaultModel: 'gemini-2.5-flash' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free' },
  ollama: { baseUrl: 'http://localhost:11434/v1', keyEnv: null, defaultModel: 'qwen2.5:7b' },
}

/** LLM_PROVIDER if set, else the first hosted provider with a key, else local Ollama. */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const name = env.LLM_PROVIDER ?? Object.keys(PRESETS).find((p) => PRESETS[p].keyEnv && env[PRESETS[p].keyEnv!]) ?? 'ollama'
  const preset = PRESETS[name]
  if (!preset) throw new Error(`Unknown LLM_PROVIDER "${name}". Use one of: ${Object.keys(PRESETS).join(', ')}.`)
  const apiKey = preset.keyEnv ? env[preset.keyEnv] : undefined
  if (preset.keyEnv && !apiKey) throw new Error(`LLM_PROVIDER=${name} needs ${preset.keyEnv} in the environment or .env.`)
  return openAiCompatible({
    name,
    baseUrl: env.LLM_BASE_URL ?? preset.baseUrl,
    apiKey,
    model: env.LLM_MODEL ?? preset.defaultModel,
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 60_000),
  })
}

export function openAiCompatible(config: { name: string; baseUrl: string; apiKey?: string; model: string; timeoutMs: number }): LlmProvider {
  async function once(messages: ChatMessage[], options: { temperature?: number; maxTokens?: number }) {
    const started = Date.now()
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0,
        max_tokens: options.maxTokens ?? 900,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    })
    if (!response.ok) {
      const error = new Error(`${config.name} returned HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`)
      ;(error as Error & { status?: number }).status = response.status
      throw error
    }
    const data = (await response.json()) as {
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
      try {
        return await once(messages, options)
      } catch (error) {
        // One patient retry for rate limits and transient server errors; anything else is the caller's problem.
        const status = (error as { status?: number }).status
        if (status !== 429 && !(status && status >= 500)) throw error
        await new Promise((resolve) => setTimeout(resolve, 5_000))
        return once(messages, options)
      }
    },
  }
}
