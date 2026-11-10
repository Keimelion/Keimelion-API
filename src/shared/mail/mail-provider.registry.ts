import { createResendMailProvider } from './adapters/resend.adapter.js'
import type { MailProviderFactory } from './mail-provider.js'

export const MAIL_PROVIDER_FACTORIES = {
  resend: createResendMailProvider,
} as const satisfies Record<string, MailProviderFactory>

export type MailProviderName = keyof typeof MAIL_PROVIDER_FACTORIES

export const DEFAULT_MAIL_PROVIDER: MailProviderName = 'resend'

export const MAIL_PROVIDER_NAMES = Object.keys(MAIL_PROVIDER_FACTORIES) as [
  MailProviderName,
  ...MailProviderName[],
]
