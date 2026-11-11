export const MailProviderNames = {
  RESEND: 'resend',
  LOG: 'log',
} as const

export type MailProviderName = (typeof MailProviderNames)[keyof typeof MailProviderNames]

export const MAIL_PROVIDER_NAMES = Object.values(MailProviderNames) as [
  MailProviderName,
  ...MailProviderName[],
]

export const DEFAULT_MAIL_PROVIDER: MailProviderName = MailProviderNames.RESEND
