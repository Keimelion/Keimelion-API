import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MailMessage, MailProvider } from '../mail-provider.js'
import { createResendMailProvider } from './resend.adapter.js'

const API_KEY = 'test-provider-key'

const message: MailMessage = {
  from: 'noreply@keimelion.app',
  to: 'recipient@example.com',
  subject: 'Subject',
  html: '<p>Body</p>',
  text: 'Body',
  headers: { 'List-Unsubscribe': '<https://keimelion.app/unsubscribe>' },
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('createResendMailProvider', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const signal = new AbortController().signal
  let provider: MailProvider

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    provider = createResendMailProvider({ apiKey: API_KEY })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps the neutral message to the provider request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'message-1' }, 200))

    await provider.send(message, signal)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.resend.com/emails')
    expect(init?.method).toBe('POST')
    expect(init?.signal).toBe(signal)
    expect(init?.headers).toEqual({
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(init?.body as string)).toEqual(message)
  })

  it('returns a neutral success with the message id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'message-1' }, 200))

    await expect(provider.send(message, signal)).resolves.toEqual({
      isSuccess: true,
      messageId: 'message-1',
    })
  })

  it('stays a success with a null id when an accepted response has no id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 200))

    await expect(provider.send(message, signal)).resolves.toEqual({
      isSuccess: true,
      messageId: null,
    })
  })

  it('returns a neutral failure exposing no provider-specific field', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 422, name: 'validation_error', message: 'Invalid `to`' }, 422),
    )

    await expect(provider.send(message, signal)).resolves.toEqual({
      isSuccess: false,
      status: 422,
      messageId: null,
    })
  })

  it('keeps the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))

    await expect(provider.send(message, signal)).resolves.toEqual({
      isSuccess: false,
      status: 502,
      messageId: null,
    })
  })

  it('lets network errors reach the shared sender', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(provider.send(message, signal)).rejects.toThrow('fetch failed')
  })
})
