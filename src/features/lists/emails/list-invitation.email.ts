import type { Locale } from '@keimelion/sdk/enums'
import { formatQuantity } from '../../../shared/mail/mail.format.js'
import {
  WebAppPaths,
  buildWebAppTokenUrl,
  privacyPolicyLink,
} from '../../../shared/mail/mail.links.js'
import { renderEmail } from '../../../shared/mail/shell/email-shell.js'
import type { EmailTextRun, RenderedEmail } from '../../../shared/mail/shell/email-shell.js'
import { EmailBannerThemes } from '../../../shared/mail/shell/email-shell.theme.js'

export interface ListInvitationEmailInput {
  locale: Locale
  inviterName: string | null
  inviterEmail: string
  listName: string
  inviteToken: string
  validityDays: number
}

interface ListInvitationCopy {
  subject: (inviter: string, listName: string) => string
  preheader: string
  kicker: string
  title: (inviter: string) => string
  body: (inviter: EmailTextRun[], listName: string) => EmailTextRun[]
  cta: string
  noAccount: string
  validity: (days: number) => string
  ignore: (inviter: string) => string
  reason: (inviter: string) => string
}

const LIST_INVITATION_COPY: Record<Locale, ListInvitationCopy> = {
  fr: {
    subject: (inviter, listName) => `${inviter} vous invite sur la liste « ${listName} »`,
    preheader: "Rejoignez la liste pour l'organiser ensemble sur Keimêlion.",
    kicker: "à plusieurs, c'est mieux !",
    title: (inviter) => `${inviter} vous invite à collaborer.`,
    body: (inviter, listName) => [
      ...inviter,
      ' vous invite à gérer ensemble la liste « ',
      { strong: listName },
      ' » sur Keimêlion : ajouter des idées, suivre les réservations, préparer le grand jour.',
    ],
    cta: 'Rejoindre la liste',
    noAccount: 'Pas encore de compte ?',
    validity: (days) =>
      `Vous pourrez en créer un gratuitement en acceptant. L'invitation est valable ${formatQuantity(days, 'jour', 'jours')}.`,
    ignore: (inviter) =>
      `Vous ne connaissez pas ${inviter} ? Ignorez cet e-mail : l'invitation expirera d'elle-même et votre adresse sera supprimée.`,
    reason: (inviter) =>
      `Vous recevez cet e-mail car ${inviter} a saisi votre adresse pour vous inviter sur Keimêlion. Notre politique de confidentialité explique comment nous utilisons votre adresse et combien de temps l'invitation est conservée.`,
  },
  en: {
    subject: (inviter, listName) => `${inviter} invited you to the list “${listName}”`,
    preheader: 'Join the list and plan it together on Keimêlion.',
    kicker: 'better together!',
    title: (inviter) => `${inviter} invited you to collaborate.`,
    body: (inviter, listName) => [
      ...inviter,
      ' invited you to manage the list “',
      { strong: listName },
      '” together on Keimêlion: add ideas, follow reservations, get ready for the big day.',
    ],
    cta: 'Join the list',
    noAccount: 'No account yet?',
    validity: (days) =>
      `You can create one for free when you accept. The invitation is valid for ${formatQuantity(days, 'day', 'days')}.`,
    ignore: (inviter) =>
      `Don't know ${inviter}? Ignore this email: the invitation will expire on its own and your address will be deleted.`,
    reason: (inviter) =>
      `You're receiving this email because ${inviter} entered your address to invite you to Keimêlion. Our privacy policy explains how we use your address and how long the invitation is kept.`,
  },
}

export function buildListInvitationEmail(input: ListInvitationEmailInput): RenderedEmail {
  const copy = LIST_INVITATION_COPY[input.locale]
  const inviter = input.inviterName ?? input.inviterEmail
  return renderEmail({
    locale: input.locale,
    subject: copy.subject(inviter, input.listName),
    preheader: copy.preheader,
    bannerTheme: EmailBannerThemes.INVITATION,
    kicker: copy.kicker,
    title: copy.title(inviter),
    paragraphs: [copy.body(inviterIdentity(input), input.listName)],
    action: {
      label: copy.cta,
      url: buildWebAppTokenUrl(WebAppPaths.ACCEPT_LIST_INVITE, input.inviteToken),
    },
    infoBox: { highlight: copy.noAccount, text: copy.validity(input.validityDays) },
    closingNote: copy.ignore(inviter),
    footerReason: copy.reason(inviter),
    footerLinks: [privacyPolicyLink(input.locale)],
  })
}

// "Name (address)", or the address alone for an inviter without a username
function inviterIdentity(input: ListInvitationEmailInput): EmailTextRun[] {
  if (input.inviterName === null) return [{ strong: input.inviterEmail }]
  return [{ strong: input.inviterName }, ` (${input.inviterEmail})`]
}
