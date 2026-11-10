import { logger } from '../../utils/logger.js'
import type { MailProvider } from '../mail-provider.js'

export function createLogMailProvider(): MailProvider {
  return {
    send: (message) => {
      logger.info({ ...message }, 'Email written to the log instead of being sent')
      return Promise.resolve({ isSuccess: true, messageId: null })
    },
  }
}
