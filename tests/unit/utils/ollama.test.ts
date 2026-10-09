import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { callOllama, callOllamaChat, searchOllama, ModelCallError } from '@/server/utils/ollama'

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

  it('throws a ModelCallError carrying only the status for a 404', async () => {
    respond({ error: 'model "secret-model" not found' }, false, 404)
    const error = await callOllama(input).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModelCallError)
    expect((error as Error).message).toBe('Ollama returned HTTP 404')
  })

  it('throws a fixed message, without quoting the body, when a 200 reply is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token S in JSON at position 0: SECRET BODY TEXT')
      },
    })
    const error = await callOllama(input).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModelCallError)
    expect((error as Error).message).toBe('Ollama reply was not JSON')
  })

  it('throws a ModelCallError when the reply has no content', async () => {
    respond({ message: {} })
    await expect(callOllama(input)).rejects.toBeInstanceOf(ModelCallError)
  })

  it('trims the key before using it as the bearer token', async () => {
    vi.stubEnv('OLLAMA_API_KEY', '  secret-key\n')
    respond({ message: { content: 'x' } })
    await callOllama(input)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-key')
  })

  it('treats a key that is only whitespace as unset', async () => {
    vi.stubEnv('OLLAMA_API_KEY', ' \n ')
    const error = await callOllama(input).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModelCallError)
    expect((error as Error).message).toBe('OLLAMA_API_KEY is not set')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws before calling out when the key is unset', async () => {
    vi.stubEnv('OLLAMA_API_KEY', '')
    await expect(callOllama(input)).rejects.toThrow('OLLAMA_API_KEY is not set')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

const chatInput = {
  model: 'glm-5.3',
  messages: [{ role: 'system' as const, content: 'sys' }, { role: 'user' as const, content: 'hi' }],
  tools: [{ type: 'function' as const, function: { name: 'web_search', description: 'd', parameters: { type: 'object' } } }],
  timeoutMs: 5000,
}

describe('callOllamaChat', () => {
  it('posts the messages and tools, non-streaming, at temperature 0.3, with no format and no think setting', async () => {
    respond({ message: { role: 'assistant', content: 'Hello' }, prompt_eval_count: 12, eval_count: 34 })
    const result = await callOllamaChat(chatInput)
    expect(result).toEqual({ text: 'Hello', toolCalls: [], promptTokens: 12, outputTokens: 34 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://ollama.com/api/chat')
    expect(init.headers.Authorization).toBe('Bearer secret-key')
    const body = JSON.parse(init.body)
    expect(body).toEqual({ model: 'glm-5.3', stream: false, options: { temperature: 0.3 }, messages: chatInput.messages, tools: chatInput.tools })
    expect('format' in body).toBe(false)
    expect('think' in body).toBe(false)
  })
  it('passes images on a message through untouched', async () => {
    respond({ message: { role: 'assistant', content: 'A red square.' } })
    const messages = [{ role: 'system' as const, content: 'sys' }, { role: 'user' as const, content: 'what is this', images: ['AAAA', 'BBBB'] }]
    await callOllamaChat({ ...chatInput, messages })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual(messages)
  })
  it('returns tool calls in the service shape and allows empty content with them', async () => {
    respond({ message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'web_search', arguments: { query: 'moen 1225' } } }] } })
    expect(await callOllamaChat(chatInput)).toEqual({
      text: '',
      toolCalls: [{ function: { name: 'web_search', arguments: { query: 'moen 1225' } } }],
      promptTokens: null,
      outputTokens: null,
    })
  })
  it('drops malformed tool calls and keeps well-formed ones', async () => {
    respond({ message: { content: '', tool_calls: [{ function: { name: 'web_search' } }, 'junk', { function: { name: 'web_search', arguments: { query: 'x' } } }] } })
    expect((await callOllamaChat(chatInput)).toolCalls).toEqual([{ function: { name: 'web_search', arguments: { query: 'x' } } }])
  })
  it('throws when the reply has neither content nor tool calls', async () => {
    respond({ message: { content: '  ' } })
    await expect(callOllamaChat(chatInput)).rejects.toThrow('Ollama returned no content')
  })
  it('throws a fixed message on a non-2xx and on a non-JSON reply', async () => {
    respond({ error: 'secret prompt echoed' }, false, 503)
    await expect(callOllamaChat(chatInput)).rejects.toThrow('Ollama returned HTTP 503')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token s in "secret"') } })
    await expect(callOllamaChat(chatInput)).rejects.toThrow('Ollama reply was not JSON')
  })
  it('throws without the key', async () => {
    vi.stubEnv('OLLAMA_API_KEY', '')
    await expect(callOllamaChat(chatInput)).rejects.toThrow('OLLAMA_API_KEY is not set')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('searchOllama', () => {
  it('posts the query with the result cap and maps the results, cutting snippets', async () => {
    respond({ results: [{ title: 'T', url: 'https://x.y/z', content: 'c'.repeat(2000) }, { title: 'U', url: 'https://x.y/w', content: 'short' }] })
    const results = await searchOllama('moen 1225 stuck', 4000)
    expect(results).toEqual([{ title: 'T', url: 'https://x.y/z', content: 'c'.repeat(1500) }, { title: 'U', url: 'https://x.y/w', content: 'short' }])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://ollama.com/api/web_search')
    expect(init.headers.Authorization).toBe('Bearer secret-key')
    expect(JSON.parse(init.body)).toEqual({ query: 'moen 1225 stuck', max_results: 5 })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it('drops results that are not objects with string fields and accepts an empty list', async () => {
    respond({ results: ['junk', { title: 1, url: 'u', content: 'c' }, { title: 'ok', url: 'https://a.b', content: '' }] })
    expect(await searchOllama('q', 4000)).toEqual([{ title: 'ok', url: 'https://a.b', content: '' }])
    respond({ results: [] })
    expect(await searchOllama('q', 4000)).toEqual([])
  })
  it('returns at most five results', async () => {
    respond({ results: Array.from({ length: 7 }, (_, i) => ({ title: `T${i}`, url: `https://x.y/${i}`, content: 'c' })) })
    const results = await searchOllama('q', 4000)
    expect(results).toHaveLength(5)
    expect(results.map((r) => r.title)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4'])
  })
  it('throws fixed text on a non-2xx, on non-JSON and without the key', async () => {
    respond({ error: 'the query was: secret' }, false, 429)
    await expect(searchOllama('q', 4000)).rejects.toThrow('Ollama search returned HTTP 429')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('secret') } })
    await expect(searchOllama('q', 4000)).rejects.toThrow('Ollama search reply was not JSON')
    vi.stubEnv('OLLAMA_API_KEY', '')
    await expect(searchOllama('q', 4000)).rejects.toThrow('OLLAMA_API_KEY is not set')
  })
})
