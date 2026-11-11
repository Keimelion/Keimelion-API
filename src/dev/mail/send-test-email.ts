import { LOCALES } from '@keimelion/sdk/enums'
import { env } from '../../config/env.js'
import { sendMail } from '../../shared/mail/mail.sender.js'
import { parseLocale } from '../../shared/utils/locale.js'
import { logger } from '../../shared/utils/logger.js'
import { EMAIL_CATALOG, findCatalogEmail } from './email-catalog.js'

const USAGE = `Usage: npm run mail:test -- <template> <locale>
Templates: ${EMAIL_CATALOG.map((email) => email.name).join(', ')}
Locales: ${LOCALES.join(', ')}`

const [templateName = '', localeArgument = ''] = process.argv.slice(2)
const email = findCatalogEmail(templateName)
const locale = parseLocale(localeArgument)

if (email === null || locale === null) exitWithError(USAGE)
if (!env.MAIL_TEST_TO) exitWithError('MAIL_TEST_TO is missing: set it in your local .env file')

const result = await sendMail({ to: env.MAIL_TEST_TO, ...email.render(locale) })
if (!result.isSuccess) exitWithError(`Test email not sent: ${result.reason}`)

logger.info({ template: email.name, locale, messageId: result.messageId }, 'Test email sent')
process.exit(0)

function exitWithError(message: string): never {
  logger.error(message)
  process.exit(1)
}
