import type { Locale } from '@keimelion/sdk/enums'
import { env } from '../../../config/env.js'
import { renderEmail } from '../../../shared/mail/shell/email-shell.js'
import type { RenderedEmail } from '../../../shared/mail/shell/email-shell.js'
import { EmailBannerThemes } from '../../../shared/mail/shell/email-shell.theme.js'

const TOKEN_FRAGMENT_KEY = 'token'

export interface WaitlistConfirmationEmailInput {
  locale: Locale
  confirmationToken: string
  unsubscribeToken: string
}

interface WaitlistLandingPaths {
  confirm: string
  unsubscribe: string
  privacy: string
}

interface WaitlistConfirmationCopy {
  subject: string
  preheader: string
  kicker: string
  title: string
  greeting: string
  body: string
  cta: string
  validity: (days: number) => string
  next: string
  ignore: (days: number) => string
  privacyLink: string
  unsubscribeLink: string
}

const WAITLIST_LANDING_PATHS: Record<Locale, WaitlistLandingPaths> = {
  fr: {
    confirm: '/confirmer-inscription',
    unsubscribe: '/supprimer-inscription',
    privacy: '/politique-de-confidentialite',
  },
  en: {
    confirm: '/en/confirm-signup',
    unsubscribe: '/en/delete-signup',
    privacy: '/en/privacy-policy',
  },
}

const WAITLIST_CONFIRMATION_COPY: Record<Locale, WaitlistConfirmationCopy> = {
  fr: {
    subject: 'Confirmez votre inscription à Keimêlion',
    preheader: "Un clic pour rejoindre la liste d'attente, et on vous prévient au lancement.",
    kicker: 'presque emballé !',
    title: "Il ne reste qu'un clic.",
    greeting: 'Bonjour,',
    body: "Vous avez demandé à être prévenu du lancement de Keimêlion : confirmez votre adresse pour rejoindre la liste d'attente.",
    cta: 'Confirmer mon inscription',
    validity: (days) => `Ce lien est valable ${formatDays(days, 'jour', 'jours')}.`,
    next: "Ensuite, nous ne vous écrirons qu'une seule fois : le jour du lancement.",
    ignore: (days) =>
      `Vous n'êtes pas à l'origine de cette demande ? Ignorez simplement cet e-mail : sans confirmation, votre adresse sera supprimée sous ${formatDays(days, 'jour', 'jours')}.`,
    privacyLink: 'Politique de confidentialité',
    unsubscribeLink: 'Supprimer mon inscription',
  },
  en: {
    subject: 'Confirm your Keimêlion signup',
    preheader: "One click to join the waitlist, and we'll let you know at launch.",
    kicker: 'almost wrapped!',
    title: 'Just one click left.',
    greeting: 'Hello,',
    body: 'You asked to be notified when Keimêlion launches: confirm your address to join the waitlist.',
    cta: 'Confirm my signup',
    validity: (days) => `This link is valid for ${formatDays(days, 'day', 'days')}.`,
    next: "After that, we'll email you just once: on launch day.",
    ignore: (days) =>
      `Didn't request this? Just ignore this email: without confirmation, your address will be deleted within ${formatDays(days, 'day', 'days')}.`,
    privacyLink: 'Privacy policy',
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
    paragraphs: [copy.greeting, copy.body],
    action: { label: copy.cta, url: buildTokenUrl(paths.confirm, input.confirmationToken) },
    infoBox: { highlight: copy.validity(validityDays), text: copy.next },
    closingNote: copy.ignore(validityDays),
    footerLinks: [
      { label: copy.privacyLink, url: new URL(paths.privacy, env.LANDING_URL).href },
      {
        label: copy.unsubscribeLink,
        url: buildTokenUrl(paths.unsubscribe, input.unsubscribeToken),
      },
    ],
  })
}

function formatDays(days: number, singular: string, plural: string): string {
  return `${String(days)} ${days === 1 ? singular : plural}`
}

// Tokens travel in the URL fragment: browsers never send it to the server, so it stays out of
// the reverse-proxy access logs of the landing.
function buildTokenUrl(path: string, token: string): string {
  const url = new URL(path, env.LANDING_URL)
  url.hash = new URLSearchParams({ [TOKEN_FRAGMENT_KEY]: token }).toString()
  return url.href
}
