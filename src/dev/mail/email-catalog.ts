import { UserRoles } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import { buildStaffInvitationEmail } from '../../features/admin/users/emails/staff-invitation.email.js'
import { buildEmailVerificationEmail } from '../../features/auth/emails/email-verification.email.js'
import { buildPasswordResetEmail } from '../../features/auth/emails/password-reset.email.js'
import { buildListInvitationEmail } from '../../features/lists/emails/list-invitation.email.js'
import { buildWaitlistConfirmationEmail } from '../../features/waitlist/emails/waitlist-confirmation.email.js'
import type { RenderedEmail } from '../../shared/mail/shell/email-shell.js'

const SAMPLE_CONFIRMATION_TOKEN = 'Xq3vS4mpLeConfirmationTokenForPreview000001'
const SAMPLE_UNSUBSCRIBE_TOKEN = 'Xq3vS4mpLeUnsubscribeTokenForPreview0000001'
const SAMPLE_VERIFY_TOKEN = '00000000-0000-4000-8000-000000000176'
const SAMPLE_RESET_TOKEN = 'a1b2c3d4'.repeat(8)
const SAMPLE_STAFF_EMAIL = 'camille@example.com'
const SAMPLE_INVITER_NAME = 'Léa Martin'
const SAMPLE_INVITER_EMAIL = 'lea@example.com'
const SAMPLE_LIST_NAME = 'Le mariage de Léa & Axel'
const SAMPLE_VALIDITY_HOURS = 24
const SAMPLE_RESET_VALIDITY_HOURS = 1
const SAMPLE_INVITE_VALIDITY_DAYS = 7

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
  {
    name: 'email-verification',
    description: 'Registration: verify the email address (web app link)',
    render: (locale) =>
      buildEmailVerificationEmail({
        locale,
        verifyToken: SAMPLE_VERIFY_TOKEN,
        validityHours: SAMPLE_VALIDITY_HOURS,
      }),
  },
  {
    name: 'password-reset',
    description: 'Forgot password of a regular user (web app link)',
    render: (locale) =>
      buildPasswordResetEmail({
        locale,
        role: UserRoles.USER,
        resetToken: SAMPLE_RESET_TOKEN,
        validityHours: SAMPLE_RESET_VALIDITY_HOURS,
      }),
  },
  {
    name: 'password-reset-staff',
    description: 'Forgot password of a moderator or admin (Backoffice link)',
    render: (locale) =>
      buildPasswordResetEmail({
        locale,
        role: UserRoles.MODERATOR,
        resetToken: SAMPLE_RESET_TOKEN,
        validityHours: SAMPLE_RESET_VALIDITY_HOURS,
      }),
  },
  {
    name: 'staff-invitation',
    description: 'Admin creates a moderator or admin: set the password (Backoffice link)',
    render: (locale) =>
      buildStaffInvitationEmail({
        locale,
        role: UserRoles.MODERATOR,
        email: SAMPLE_STAFF_EMAIL,
        setPasswordToken: SAMPLE_RESET_TOKEN,
        validityHours: SAMPLE_VALIDITY_HOURS,
      }),
  },
  {
    name: 'list-invitation',
    description: 'List owner invites a collaborator (web app link)',
    render: (locale) =>
      buildListInvitationEmail({
        locale,
        inviterName: SAMPLE_INVITER_NAME,
        inviterEmail: SAMPLE_INVITER_EMAIL,
        listName: SAMPLE_LIST_NAME,
        inviteToken: SAMPLE_RESET_TOKEN,
        validityDays: SAMPLE_INVITE_VALIDITY_DAYS,
      }),
  },
]

export function findCatalogEmail(name: string): CatalogEmail | null {
  return EMAIL_CATALOG.find((email) => email.name === name) ?? null
}
