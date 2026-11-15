import type { Locale, StaffRole } from '@keimelion/sdk/enums'
import { EMAIL_CONTACT_ADDRESS } from '../../../../shared/mail/mail.constants.js'
import { formatQuantity } from '../../../../shared/mail/mail.format.js'
import {
  buildBackofficeSetPasswordUrl,
  privacyPolicyLink,
} from '../../../../shared/mail/mail.links.js'
import { renderEmail } from '../../../../shared/mail/shell/email-shell.js'
import type { EmailTextRun, RenderedEmail } from '../../../../shared/mail/shell/email-shell.js'
import { EmailBannerThemes } from '../../../../shared/mail/shell/email-shell.theme.js'

export interface StaffInvitationEmailInput {
  locale: Locale
  role: StaffRole
  email: string
  setPasswordToken: string
  validityHours: number
}

interface StaffInvitationCopy {
  subject: string
  preheader: (role: StaffRole) => string
  kicker: string
  title: string
  greeting: string
  body: (role: StaffRole, email: string) => EmailTextRun[]
  cta: string
  validity: (hours: number) => string
  singleUse: string
  ignore: string
  reason: string
}

const FR_ROLE_LABELS: Record<StaffRole, string> = {
  moderator: 'modérateur',
  admin: 'administrateur',
}

const EN_ROLE_LABELS: Record<StaffRole, string> = {
  moderator: 'moderator',
  admin: 'administrator',
}

const EN_ROLE_ARTICLES: Record<StaffRole, string> = {
  moderator: 'a',
  admin: 'an',
}

const STAFF_INVITATION_COPY: Record<Locale, StaffInvitationCopy> = {
  fr: {
    subject: 'Votre accès au Backoffice Keimêlion',
    preheader: (role) =>
      `Définissez votre mot de passe pour activer votre compte ${FR_ROLE_LABELS[role]}.`,
    kicker: "bienvenue dans l'équipe",
    title: 'Votre accès au Backoffice est prêt.',
    greeting: 'Bonjour,',
    body: (role, email) => [
      'Un administrateur de Keimêlion vous a créé un compte ',
      { strong: FR_ROLE_LABELS[role] },
      " sur le Backoffice, avec l'adresse ",
      { strong: email },
      ". Définissez votre mot de passe pour l'activer.",
    ],
    cta: 'Définir mon mot de passe',
    validity: (hours) => `Ce lien est valable ${formatQuantity(hours, 'heure', 'heures')}`,
    singleUse:
      "et ne fonctionne qu'une seule fois. Choisissez un mot de passe que vous n'utilisez nulle part ailleurs.",
    ignore: `Vous ne vous attendiez pas à cet e-mail ? N'utilisez pas le lien et prévenez-nous à ${EMAIL_CONTACT_ADDRESS}.`,
    reason:
      'Vous recevez cet e-mail car un administrateur de Keimêlion a créé un compte Backoffice avec cette adresse.',
  },
  en: {
    subject: 'Your Keimêlion Backoffice access',
    preheader: (role) => `Set your password to activate your ${EN_ROLE_LABELS[role]} account.`,
    kicker: 'welcome to the team',
    title: 'Your Backoffice access is ready.',
    greeting: 'Hello,',
    body: (role, email) => [
      `A Keimêlion administrator created ${EN_ROLE_ARTICLES[role]} `,
      { strong: EN_ROLE_LABELS[role] },
      ' account for you on the Backoffice, with the address ',
      { strong: email },
      '. Set your password to activate it.',
    ],
    cta: 'Set my password',
    validity: (hours) => `This link is valid for ${formatQuantity(hours, 'hour', 'hours')}`,
    singleUse: "and can only be used once. Choose a password you don't use anywhere else.",
    ignore: `Weren't expecting this email? Don't use the link and let us know at ${EMAIL_CONTACT_ADDRESS}.`,
    reason:
      "You're receiving this email because a Keimêlion administrator created a Backoffice account with this address.",
  },
}

export function buildStaffInvitationEmail(input: StaffInvitationEmailInput): RenderedEmail {
  const copy = STAFF_INVITATION_COPY[input.locale]
  return renderEmail({
    locale: input.locale,
    subject: copy.subject,
    preheader: copy.preheader(input.role),
    bannerTheme: EmailBannerThemes.STAFF,
    kicker: copy.kicker,
    title: copy.title,
    paragraphs: [copy.greeting, copy.body(input.role, input.email)],
    action: { label: copy.cta, url: buildBackofficeSetPasswordUrl(input.setPasswordToken) },
    infoBox: { highlight: copy.validity(input.validityHours), text: copy.singleUse },
    closingNote: copy.ignore,
    footerReason: copy.reason,
    footerLinks: [privacyPolicyLink(input.locale)],
  })
}
