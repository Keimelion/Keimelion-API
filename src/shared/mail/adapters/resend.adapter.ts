import { z } from 'zod'
import type {
  MailMessage,
  MailProvider,
  MailProviderConfig,
  MailProviderResult,
} from '../mail-provider.js'

const RESEND_SEND_EMAIL_URL = 'https://api.resend.com/emails'

const resendResponseSchema = z.object({ id: z.string().min(1) })

export function createResendMailProvider(config: MailProviderConfig): MailProvider {
  return {
    send: async (message, signal): Promise<MailProviderResult> => {
      const response = await fetch(RESEND_SEND_EMAIL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toResendRequest(message)),
        signal,
      })
      return toMailProviderResult(response)
    },
  }
}

function toResendRequest(message: MailMessage): Record<string, unknown> {
  return {
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: message.headers,
  }
}

async function toMailProviderResult(response: Response): Promise<MailProviderResult> {
  const messageId = await readMessageId(response)
  if (response.ok) return { isSuccess: true, messageId }
  return { isSuccess: false, status: response.status, messageId }
}

async function readMessageId(response: Response): Promise<string | null> {
  try {
    const parsedBody = resendResponseSchema.safeParse(await response.json())
    return parsedBody.success ? parsedBody.data.id : null
  } catch {
    return null
  }
}
