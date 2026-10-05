import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { callOllama } from '@/server/utils/ollama'

const fetchMock = vi.fn()
const input = { model: 'glm-5.3-flash', system: 'sys', user: 'usr', timeoutMs: 5000 }
const respond = (body: unknown, ok = true, status = 200) => fetchMock.mockResolvedValue({ ok, status, json: async () => body })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('OLLAMA_API_KEY', 'secret-key')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  fetchMock.mockReset()
})

describe('callOllama', () => {
  it('posts one non-streaming chat request with the key as a bearer token', async () => {
    respond({ message: { content: '{"a":1}' }, prompt_eval_count: 12, eval_count: 34 })
    const result = await callOllama(input)
    expect(result).toEqual({ text: '{"a":1}', promptTokens: 12, outputTokens: 34 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://ollama.com/api/chat')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer secret-key')
    expect(JSON.parse(init.body)).toEqual({
      model: 'glm-5.3-flash',
      stream: false,
      options: { temperature: 0 },
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'usr' }],
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('reports null token counts when the service does not send them', async () => {
    respond({ message: { content: 'x' } })
    expect(await callOllama(input)).toEqual({ text: 'x', promptTokens: null, outputTokens: null })
  })

  it('throws on a non-2xx response without echoing the body', async () => {
    respond({ error: 'the prompt was: secret text' }, false, 500)
    await expect(callOllama(input)).rejects.toThrow('Ollama returned HTTP 500')
  })

  it('throws when the reply has no content', async () => {
    respond({ message: { content: '   ' } })
    await expect(callOllama(input)).rejects.toThrow('Ollama returned no content')
  })

  it('throws before calling out when the key is unset', async () => {
    vi.stubEnv('OLLAMA_API_KEY', '')
    await expect(callOllama(input)).rejects.toThrow('OLLAMA_API_KEY is not set')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
