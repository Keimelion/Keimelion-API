import { MailProviderNames } from '../enums/mail-provider.js'
import { createResendMailProvider } from './adapters/resend.adapter.js'
import type { MailProviderFactory } from './mail-provider.js'

export const MAIL_PROVIDER_FACTORIES = {
  [MailProviderNames.RESEND]: createResendMailProvider,
} as const satisfies Record<string, MailProviderFactory>
