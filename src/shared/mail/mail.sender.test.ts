import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../config/env.js'
import { MailProviderNames } from '../enums/mail-provider.js'
import { NodeEnvs } from '../enums/node-env.js'
import { logger } from '../utils/logger.js'
import type { MailProvider } from './mail-provider.js'
import { MAIL_PROVIDER_FACTORIES } from './mail-provider.registry.js'
import { MAIL_REQUEST_TIMEOUT_MS, MailFailureReasons, sendMail } from './mail.sender.js'
import type { SendMailInput } from './mail.sender.js'

vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const API_KEY = 'test-provider-key'
const FROM = 'noreply@keimelion.app'
const SHORT_TIMEOUT_MS = 5
const SECRET_LINK = 'https://keimelion.app/confirm?token=secret-token'

const input: SendMailInput = {
  to: 'recipient@example.com',
  subject: 'Confirm your address',
  html: `<a href="${SECRET_LINK}">Confirm</a>`,
  text: `Confirm: ${SECRET_LINK}`,
}

const originalEnv = { ...env }

function useProductionEnv(overrides: Partial<typeof env> = {}): void {
  Object.assign(env, {
    NODE_ENV: NodeEnvs.PRODUCTION,
    EMAIL_API_KEY: API_KEY,
    EMAIL_FROM: FROM,
    ...overrides,
  })
}

function useShortTimeout(): void {
  const createTimeoutSignal = AbortSignal.timeout.bind(AbortSignal)
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => createTimeoutSignal(SHORT_TIMEOUT_MS))
}

function serializeLogCalls(): string {
  const levels = [logger.debug, logger.info, logger.warn, logger.error]
  return JSON.stringify(levels.map((level) => vi.mocked(level).mock.calls))
}

describe('sendMail', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const send = vi.fn<MailProvider['send']>()
  const fakeProvider: MailProvider = { send }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(MAIL_PROVIDER_FACTORIES, 'resend').mockReturnValue(fakeProvider)
  })

  afterEach(() => {
    Object.assign(env, originalEnv)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('in production', () => {
    beforeEach(() => {
      useProductionEnv()
    })

    it('sends the message through the provider registered for EMAIL_PROVIDER', async () => {
      send.mockResolvedValue({ isSuccess: true, messageId: 'message-1' })

      await expect(sendMail(input)).resolves.toEqual({ isSuccess: true, messageId: 'message-1' })

      expect(MAIL_PROVIDER_FACTORIES.resend).toHaveBeenCalledWith({ apiKey: API_KEY })
      expect(send).toHaveBeenCalledWith(
        { ...input, from: FROM, replyTo: 'contact@keimelion.app', headers: {} },
        expect.any(AbortSignal),
      )
    })

    it('forwards optional headers', async () => {
      send.mockResolvedValue({ isSuccess: true, messageId: 'message-1' })
      const headers = { 'List-Unsubscribe': '<https://keimelion.app/unsubscribe>' }

      await sendMail({ ...input, headers })

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ headers }),
        expect.any(AbortSignal),
      )
    })

    it('returns a failure and logs the provider status', async () => {
      send.mockResolvedValue({ isSuccess: false, status: 422 })

      await expect(sendMail(input)).resolves.toEqual({
        isSuccess: false,
        reason: MailFailureReasons.PROVIDER_ERROR,
      })

      expect(logger.error).toHaveBeenCalledWith({ status: 422 }, expect.any(String))
    })

    it('uses the documented request timeout', async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
      send.mockResolvedValue({ isSuccess: true, messageId: 'message-1' })

      await sendMail(input)

      expect(timeoutSpy).toHaveBeenCalledWith(MAIL_REQUEST_TIMEOUT_MS)
    })

    it('times out an adapter that honours the abort signal', async () => {
      useShortTimeout()
      send.mockImplementation(
        (_message, signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'TimeoutError'))
            })
          }),
      )

      await expect(sendMail(input)).resolves.toEqual({
        isSuccess: false,
        reason: MailFailureReasons.TIMEOUT,
      })
    })

    it('times out an adapter that ignores the abort signal', async () => {
      useShortTimeout()
      send.mockReturnValue(new Promise(() => undefined))

      await expect(sendMail(input)).resolves.toEqual({
        isSuccess: false,
        reason: MailFailureReasons.TIMEOUT,
      })
      expect(logger.error).toHaveBeenCalledWith(
        { timeoutMs: MAIL_REQUEST_TIMEOUT_MS },
        expect.any(String),
      )
    })

    it('never throws when the adapter rejects', async () => {
      send.mockRejectedValue(new TypeError('fetch failed'))

      await expect(sendMail(input)).resolves.toEqual({
        isSuccess: false,
        reason: MailFailureReasons.UNEXPECTED_ERROR,
      })
    })

    it('never throws when the adapter throws synchronously', async () => {
      send.mockImplementation(() => {
        throw new Error('Adapter bug')
      })

      await expect(sendMail(input)).resolves.toEqual({
        isSuccess: false,
        reason: MailFailureReasons.UNEXPECTED_ERROR,
      })
    })

    it('never throws when the adapter factory throws', async () => {
      vi.spyOn(MAIL_PROVIDER_FACTORIES, 'resend').mockImplementation(() => {
        throw new Error('Invalid adapter configuration')
      })

      await expect(sendMail(input)).resolves.toEqual({
        isSuccess: false,
        reason: MailFailureReasons.UNEXPECTED_ERROR,
      })
    })

    it('does not log recipients, bodies or the key on success', async () => {
      send.mockResolvedValue({ isSuccess: true, messageId: 'message-1' })

      await sendMail(input)

      expect(serializeLogCalls()).toContain('message-1')
      expect(serializeLogCalls()).not.toMatch(
        /recipient@example\.com|secret-token|test-provider-key/,
      )
    })

    it('does not log recipients, bodies or the key on provider failure', async () => {
      send.mockResolvedValue({ isSuccess: false, status: 500 })

      await sendMail(input)

      expect(serializeLogCalls()).not.toMatch(
        /recipient@example\.com|secret-token|test-provider-key/,
      )
    })

    it('does not log the message of an error thrown by the adapter', async () => {
      send.mockRejectedValue(new Error(`Could not deliver to ${input.to} with ${API_KEY}`))

      await sendMail(input)

      expect(logger.error).toHaveBeenCalledWith(
        { errorName: 'Error', errorCode: null },
        expect.any(String),
      )
      expect(serializeLogCalls()).not.toMatch(/recipient@example\.com|test-provider-key/)
    })

    it('logs the system code of a network failure', async () => {
      const cause = Object.assign(new Error('getaddrinfo failed'), { code: 'ENOTFOUND' })
      send.mockRejectedValue(new TypeError('fetch failed', { cause }))

      await sendMail(input)

      expect(logger.error).toHaveBeenCalledWith(
        { errorName: 'TypeError', errorCode: 'ENOTFOUND' },
        expect.any(String),
      )
    })
  })

  describe('in production with the log provider', () => {
    it('writes the email to the log without any provider or key', async () => {
      useProductionEnv({ EMAIL_PROVIDER: MailProviderNames.LOG, EMAIL_API_KEY: undefined })

      await expect(sendMail(input)).resolves.toEqual({ isSuccess: true, messageId: null })

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ to: input.to, from: FROM }),
        expect.any(String),
      )
      expect(fetchMock).not.toHaveBeenCalled()
      expect(MAIL_PROVIDER_FACTORIES.resend).not.toHaveBeenCalled()
    })
  })

  describe('in production without complete configuration', () => {
    it.each([
      ['EMAIL_API_KEY is undefined', { EMAIL_API_KEY: undefined }],
      ['EMAIL_API_KEY is empty', { EMAIL_API_KEY: '' }],
      ['EMAIL_FROM is undefined', { EMAIL_FROM: undefined }],
      ['EMAIL_FROM is empty', { EMAIL_FROM: '' }],
    ])('returns a failure and logs an error when %s', async (_label, overrides) => {
      useProductionEnv(overrides)

      await expect(sendMail(input)).resolves.toEqual({
        isSuccess: false,
        reason: MailFailureReasons.NOT_CONFIGURED,
      })

      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(MAIL_PROVIDER_FACTORIES.resend).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('outside production', () => {
    it.each([NodeEnvs.DEVELOPMENT, NodeEnvs.TEST])(
      'writes the email to the log without any network call in %s',
      async (nodeEnv) => {
        Object.assign(env, { NODE_ENV: nodeEnv, EMAIL_API_KEY: API_KEY, EMAIL_FROM: FROM })

        await expect(sendMail(input)).resolves.toEqual({ isSuccess: true, messageId: null })

        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({ ...input, from: FROM }),
          expect.any(String),
        )
        expect(fetchMock).not.toHaveBeenCalled()
        expect(MAIL_PROVIDER_FACTORIES.resend).not.toHaveBeenCalled()
      },
    )

    it('works without any email configuration', async () => {
      await expect(sendMail(input)).resolves.toEqual({ isSuccess: true, messageId: null })

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
