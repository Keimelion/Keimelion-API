import type { Locale } from '@keimelion/sdk/enums'
import { buildWaitlistConfirmationEmail } from '../../features/waitlist/emails/waitlist-confirmation.email.js'
import type { RenderedEmail } from '../../shared/mail/shell/email-shell.js'

const SAMPLE_CONFIRMATION_TOKEN = 'Xq3vS4mpLeConfirmationTokenForPreview000001'
const SAMPLE_UNSUBSCRIBE_TOKEN = 'Xq3vS4mpLeUnsubscribeTokenForPreview0000001'

export interface CatalogEmail {
  name: string
  description: string
  render: (locale: Locale) => RenderedEmail
}

// Every email the API sends, rendered with sample data. Used by `mail:dev` and `mail:test` only.
export const EMAIL_CATALOG: CatalogEmail[] = [
  {
    name: 'waitlist-confirmation',
    description: 'Waitlist double opt-in: confirm the address',
    render: (locale) =>
      buildWaitlistConfirmationEmail({
        locale,
        confirmationToken: SAMPLE_CONFIRMATION_TOKEN,
        unsubscribeToken: SAMPLE_UNSUBSCRIBE_TOKEN,
      }),
  },
]

export function findCatalogEmail(name: string): CatalogEmail | null {
  return EMAIL_CATALOG.find((email) => email.name === name) ?? null
}
