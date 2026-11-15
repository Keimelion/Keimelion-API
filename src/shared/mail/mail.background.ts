import { readErrorName } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import { sendMail } from './mail.sender.js'
import type { SendMailInput } from './mail.sender.js'

// The request never waits for the provider and a provider failure never fails it.
// Compliance: the failure log carries neither the recipient nor the link of the email.
export function sendMailInBackground(failureEvent: string, composeMail: () => SendMailInput): void {
  void deliverMail(failureEvent, composeMail)
}

async function deliverMail(failureEvent: string, composeMail: () => SendMailInput): Promise<void> {
  try {
    const result = await sendMail(composeMail())
    if (result.isSuccess) return

    logger.warn({ event: failureEvent, reason: result.reason })
  } catch (error) {
    logger.error({ event: failureEvent, errorName: readErrorName(error) })
  }
}
