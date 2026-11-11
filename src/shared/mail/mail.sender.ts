import { env } from '../../config/env.js'
import { MailProviderNames } from '../enums/mail-provider.js'
import { NodeEnvs } from '../enums/node-env.js'
import { logger } from '../utils/logger.js'
import { createLogMailProvider } from './adapters/log.adapter.js'
import { EMAIL_CONTACT_ADDRESS } from './mail.constants.js'
import type {
  MailMessage,
  MailProvider,
  MailProviderResult,
  MailProviderSuccess,
} from './mail-provider.js'
import { MAIL_PROVIDER_FACTORIES } from './mail-provider.registry.js'

export const MAIL_REQUEST_TIMEOUT_MS = 10_000

const NON_PRODUCTION_FROM = 'noreply@keimelion.test'

export const MailFailureReasons = {
  NOT_CONFIGURED: 'not_configured',
  PROVIDER_ERROR: 'provider_error',
  TIMEOUT: 'timeout',
  UNEXPECTED_ERROR: 'unexpected_error',
} as const

export type MailFailureReason = (typeof MailFailureReasons)[keyof typeof MailFailureReasons]

export interface SendMailInput {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

export type SendMailResult = MailProviderSuccess | { isSuccess: false; reason: MailFailureReason }

interface MailTransport {
  provider: MailProvider
  from: string
}

// Compliance: production logs must never carry recipients, bodies or raw provider errors,
// because emails hold personal data and secret links (confirmation, unsubscribe).
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const signal = AbortSignal.timeout(MAIL_REQUEST_TIMEOUT_MS)
  try {
    return await deliverMail(input, signal)
  } catch (error) {
    return toThrownErrorFailure(error, signal)
  }
}

async function deliverMail(input: SendMailInput, signal: AbortSignal): Promise<SendMailResult> {
  const transport = resolveMailTransport()
  if (!transport) {
    logger.error('Email not sent: EMAIL_API_KEY and EMAIL_FROM are required in production')
    return { isSuccess: false, reason: MailFailureReasons.NOT_CONFIGURED }
  }

  const result = await Promise.race([
    transport.provider.send(toMailMessage(input, transport.from), signal),
    rejectOnAbort(signal),
  ])
  return toSendMailResult(result)
}

function resolveMailTransport(): MailTransport | null {
  if (env.NODE_ENV !== NodeEnvs.PRODUCTION || env.EMAIL_PROVIDER === MailProviderNames.LOG) {
    return { provider: createLogMailProvider(), from: env.EMAIL_FROM ?? NON_PRODUCTION_FROM }
  }
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) return null

  const createProvider = MAIL_PROVIDER_FACTORIES[env.EMAIL_PROVIDER]
  return { provider: createProvider({ apiKey: env.EMAIL_API_KEY }), from: env.EMAIL_FROM }
}

function toMailMessage(input: SendMailInput, from: string): MailMessage {
  return {
    from,
    replyTo: EMAIL_CONTACT_ADDRESS,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: input.headers ?? {},
  }
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(new Error('Mail provider request aborted'))
      },
      { once: true },
    )
  })
}

function toSendMailResult(result: MailProviderResult): SendMailResult {
  if (result.isSuccess) {
    logger.info({ messageId: result.messageId }, 'Email accepted by the mail provider')
    return result
  }

  logger.error({ status: result.status }, 'Email rejected by the mail provider')
  return { isSuccess: false, reason: MailFailureReasons.PROVIDER_ERROR }
}

function toThrownErrorFailure(error: unknown, signal: AbortSignal): SendMailResult {
  if (signal.aborted) {
    logger.error({ timeoutMs: MAIL_REQUEST_TIMEOUT_MS }, 'Mail provider request timed out')
    return { isSuccess: false, reason: MailFailureReasons.TIMEOUT }
  }

  const errorName = error instanceof Error ? error.name : typeof error
  logger.error(
    { errorName, errorCode: readErrorCauseCode(error) },
    'Mail provider failed with an unexpected error',
  )
  return { isSuccess: false, reason: MailFailureReasons.UNEXPECTED_ERROR }
}

// fetch hides network failures behind `TypeError: fetch failed`, the system code is on the cause.
function readErrorCauseCode(error: unknown): string | null {
  if (!(error instanceof Error) || !(error.cause instanceof Error)) return null
  if (!('code' in error.cause) || typeof error.cause.code !== 'string') return null
  return error.cause.code
}
