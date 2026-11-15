import type { Locale } from '@keimelion/sdk/enums'
import { env } from '../../../config/env.js'
import { formatQuantity } from '../../../shared/mail/mail.format.js'
import { buildFragmentTokenUrl, privacyPolicyLink } from '../../../shared/mail/mail.links.js'
import { renderEmail } from '../../../shared/mail/shell/email-shell.js'
import type { RenderedEmail } from '../../../shared/mail/shell/email-shell.js'
import { EmailBannerThemes } from '../../../shared/mail/shell/email-shell.theme.js'

export interface WaitlistConfirmationEmailInput {
  locale: Locale
  confirmationToken: string
  unsubscribeToken: string
}

interface WaitlistLandingPaths {
  confirm: string
  unsubscribe: string
}

interface WaitlistConfirmationCopy {
  subject: string
  preheader: string
  kicker: string
  title: string
  body: string
  cta: string
  validity: (days: number) => string
  next: string
  ignore: (days: number) => string
  unsubscribeLink: string
}

const WAITLIST_LANDING_PATHS: Record<Locale, WaitlistLandingPaths> = {
  fr: {
    confirm: '/confirmer-inscription',
    unsubscribe: '/supprimer-inscription',
  },
  en: {
    confirm: '/en/confirm-signup',
    unsubscribe: '/en/delete-signup',
  },
}

const WAITLIST_CONFIRMATION_COPY: Record<Locale, WaitlistConfirmationCopy> = {
  fr: {
    subject: 'Confirmez votre inscription à Keimêlion',
    preheader: "Un clic pour rejoindre la liste d'attente, et on vous prévient au lancement.",
    kicker: 'presque emballé !',
    title: "Il ne reste qu'un clic.",
    body: "Vous avez demandé à être prévenu du lancement de Keimêlion : confirmez votre adresse pour rejoindre la liste d'attente.",
    cta: 'Confirmer mon inscription',
    validity: (days) => `Ce lien est valable ${formatQuantity(days, 'jour', 'jours')}.`,
    next: "Ensuite, nous ne vous écrirons qu'une seule fois : le jour du lancement.",
    ignore: (days) =>
      `Vous n'êtes pas à l'origine de cette demande ? Ignorez simplement cet e-mail : sans confirmation, votre adresse sera supprimée sous ${formatQuantity(days, 'jour', 'jours')}.`,
    unsubscribeLink: 'Supprimer mon inscription',
  },
  en: {
    subject: 'Confirm your Keimêlion signup',
    preheader: "One click to join the waitlist, and we'll let you know at launch.",
    kicker: 'almost wrapped!',
    title: 'Just one click left.',
    body: 'You asked to be notified when Keimêlion launches: confirm your address to join the waitlist.',
    cta: 'Confirm my signup',
    validity: (days) => `This link is valid for ${formatQuantity(days, 'day', 'days')}.`,
    next: "After that, we'll email you just once: on launch day.",
    ignore: (days) =>
      `Didn't request this? Just ignore this email: without confirmation, your address will be deleted within ${formatQuantity(days, 'day', 'days')}.`,
    unsubscribeLink: 'Delete my signup',
  },
}

export function buildWaitlistConfirmationEmail(
  input: WaitlistConfirmationEmailInput,
): RenderedEmail {
  const copy = WAITLIST_CONFIRMATION_COPY[input.locale]
  const paths = WAITLIST_LANDING_PATHS[input.locale]
  const validityDays = env.WAITLIST_CONFIRMATION_VALIDITY_DAYS
  return renderEmail({
    locale: input.locale,
    subject: copy.subject,
    preheader: copy.preheader,
    bannerTheme: EmailBannerThemes.WAITLIST,
    kicker: copy.kicker,
    title: copy.title,
    paragraphs: [copy.body],
    action: { label: copy.cta, url: buildTokenUrl(paths.confirm, input.confirmationToken) },
    infoBox: { highlight: copy.validity(validityDays), text: copy.next },
    closingNote: copy.ignore(validityDays),
    footerReason: null,
    footerLinks: [
      privacyPolicyLink(input.locale),
      {
        label: copy.unsubscribeLink,
        url: buildTokenUrl(paths.unsubscribe, input.unsubscribeToken),
      },
    ],
  })
}

function buildTokenUrl(path: string, token: string): string {
  return buildFragmentTokenUrl(env.LANDING_URL, path, token)
}
