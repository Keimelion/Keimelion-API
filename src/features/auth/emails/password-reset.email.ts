import { STAFF_ROLE_VALUES } from '@keimelion/sdk/enums'
import type { Locale, UserRole } from '@keimelion/sdk/enums'
import { formatQuantity } from '../../../shared/mail/mail.format.js'
import {
  WebAppPaths,
  buildBackofficeSetPasswordUrl,
  buildWebAppTokenUrl,
  privacyPolicyLink,
} from '../../../shared/mail/mail.links.js'
import { renderEmail } from '../../../shared/mail/shell/email-shell.js'
import type { RenderedEmail } from '../../../shared/mail/shell/email-shell.js'
import { EmailBannerThemes } from '../../../shared/mail/shell/email-shell.theme.js'

export interface PasswordResetEmailInput {
  locale: Locale
  role: UserRole
  resetToken: string
  validityHours: number
}

interface PasswordResetCopy {
  subject: string
  preheader: (validity: string) => string
  kicker: string
  title: string
  greeting: string
  body: string
  cta: string
  validity: (hours: number) => string
  validityHighlight: (validity: string) => string
  singleUse: string
  ignore: string
  reason: string
}

const PASSWORD_RESET_COPY: Record<Locale, PasswordResetCopy> = {
  fr: {
    subject: 'Réinitialisez votre mot de passe Keimêlion',
    preheader: (validity) => `Choisissez un nouveau mot de passe. Le lien est valable ${validity}.`,
    kicker: 'pas de panique',
    title: 'Choisissez un nouveau mot de passe.',
    greeting: 'Bonjour,',
    body: 'Vous avez demandé à réinitialiser le mot de passe de votre compte Keimêlion. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.',
    cta: 'Choisir un nouveau mot de passe',
    validity: (hours) => formatQuantity(hours, 'heure', 'heures'),
    validityHighlight: (validity) => `Ce lien est valable ${validity}`,
    singleUse: "et ne fonctionne qu'une seule fois.",
    ignore:
      "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe actuel reste inchangé.",
    reason:
      'Vous recevez cet e-mail car une réinitialisation de mot de passe a été demandée pour cette adresse.',
  },
  en: {
    subject: 'Reset your Keimêlion password',
    preheader: (validity) => `Choose a new password. The link is valid for ${validity}.`,
    kicker: 'no worries',
    title: 'Choose a new password.',
    greeting: 'Hello,',
    body: 'You asked to reset the password for your Keimêlion account. Click the button below to choose a new one.',
    cta: 'Choose a new password',
    validity: (hours) => formatQuantity(hours, 'hour', 'hours'),
    validityHighlight: (validity) => `This link is valid for ${validity}`,
    singleUse: 'and can only be used once.',
    ignore:
      "Didn't request this? Ignore this email: your current password stays the same.",
    reason:
      "You're receiving this email because a password reset was requested for this address.",
  },
}

export function buildPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const copy = PASSWORD_RESET_COPY[input.locale]
  const validity = copy.validity(input.validityHours)
  return renderEmail({
    locale: input.locale,
    subject: copy.subject,
    preheader: copy.preheader(validity),
    bannerTheme: EmailBannerThemes.ACCOUNT,
    kicker: copy.kicker,
    title: copy.title,
    paragraphs: [copy.greeting, copy.body],
    action: { label: copy.cta, url: buildResetPasswordUrl(input.role, input.resetToken) },
    infoBox: { highlight: copy.validityHighlight(validity), text: copy.singleUse },
    closingNote: copy.ignore,
    footerReason: copy.reason,
    footerLinks: [privacyPolicyLink(input.locale)],
  })
}

// Staff accounts sign in on the Backoffice, which has its own reset-password page
function buildResetPasswordUrl(role: UserRole, resetToken: string): string {
  const isStaff = STAFF_ROLE_VALUES.some((staffRole) => staffRole === role)
  if (isStaff) return buildBackofficeSetPasswordUrl(resetToken)
  return buildWebAppTokenUrl(WebAppPaths.RESET_PASSWORD, resetToken)
}
