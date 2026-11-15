import type { Locale } from '@keimelion/sdk/enums'
import { formatQuantity } from '../../../shared/mail/mail.format.js'
import {
  WebAppPaths,
  buildWebAppTokenUrl,
  privacyPolicyLink,
} from '../../../shared/mail/mail.links.js'
import { renderEmail } from '../../../shared/mail/shell/email-shell.js'
import type { RenderedEmail } from '../../../shared/mail/shell/email-shell.js'
import { EmailBannerThemes } from '../../../shared/mail/shell/email-shell.theme.js'

export interface EmailVerificationEmailInput {
  locale: Locale
  verifyToken: string
  validityHours: number
}

interface EmailVerificationCopy {
  subject: string
  preheader: string
  kicker: string
  title: string
  greeting: string
  body: string
  cta: string
  validity: (hours: number) => string
  next: string
  ignore: string
  reason: string
}

const EMAIL_VERIFICATION_COPY: Record<Locale, EmailVerificationCopy> = {
  fr: {
    subject: 'Confirmez votre adresse e-mail',
    preheader: 'Un clic pour activer votre compte Keimêlion.',
    kicker: 'bienvenue !',
    title: 'Confirmez votre adresse.',
    greeting: 'Bonjour,',
    body: "Merci d'avoir créé votre compte Keimêlion. Confirmez votre adresse e-mail pour commencer votre première liste.",
    cta: 'Confirmer mon adresse',
    validity: (hours) => `Ce lien est valable ${formatQuantity(hours, 'heure', 'heures')}.`,
    next: 'Passé ce délai, vous pourrez en demander un nouveau depuis la page de connexion.',
    ignore:
      "Vous n'avez pas créé de compte sur Keimêlion ? Ignorez simplement cet e-mail : sans confirmation, le compte ne sera pas activé.",
    reason: 'Vous recevez cet e-mail car un compte Keimêlion a été créé avec cette adresse.',
  },
  en: {
    subject: 'Confirm your email address',
    preheader: 'One click to activate your Keimêlion account.',
    kicker: 'welcome!',
    title: 'Confirm your address.',
    greeting: 'Hello,',
    body: 'Thanks for creating your Keimêlion account. Confirm your email address to start your first list.',
    cta: 'Confirm my address',
    validity: (hours) => `This link is valid for ${formatQuantity(hours, 'hour', 'hours')}.`,
    next: 'After that, you can request a new one from the sign-in page.',
    ignore:
      "Didn't create a Keimêlion account? Just ignore this email: without confirmation, the account won't be activated.",
    reason:
      "You're receiving this email because a Keimêlion account was created with this address.",
  },
}

export function buildEmailVerificationEmail(input: EmailVerificationEmailInput): RenderedEmail {
  const copy = EMAIL_VERIFICATION_COPY[input.locale]
  return renderEmail({
    locale: input.locale,
    subject: copy.subject,
    preheader: copy.preheader,
    bannerTheme: EmailBannerThemes.ACCOUNT,
    kicker: copy.kicker,
    title: copy.title,
    paragraphs: [copy.greeting, copy.body],
    action: {
      label: copy.cta,
      url: buildWebAppTokenUrl(WebAppPaths.VERIFY_EMAIL, input.verifyToken),
    },
    infoBox: { highlight: copy.validity(input.validityHours), text: copy.next },
    closingNote: copy.ignore,
    footerReason: copy.reason,
    footerLinks: [privacyPolicyLink(input.locale)],
  })
}
