export interface MailMessage {
  from: string
  replyTo: string
  to: string
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

export interface MailProviderSuccess {
  isSuccess: true
  messageId: string | null
}

export interface MailProviderFailure {
  isSuccess: false
  status: number
}

export type MailProviderResult = MailProviderSuccess | MailProviderFailure

export interface MailProvider {
  send: (message: MailMessage, signal: AbortSignal) => Promise<MailProviderResult>
}

export interface MailProviderConfig {
  apiKey: string
}

export type MailProviderFactory = (config: MailProviderConfig) => MailProvider
