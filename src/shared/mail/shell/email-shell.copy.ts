import type { Locale } from '@keimelion/sdk/enums'

export const EMAIL_CONTACT_ADDRESS = 'contact@keimelion.app'

export interface EmailShellCopy {
  brandName: string
  labelSeparator: string
  fallbackLabel: string
  signoff: string
  signature: string
  tagline: string
  publisher: string
  contact: string
}

// Compliance: the publisher identity must match the legal notice of the landing.
export const EMAIL_SHELL_COPY: Record<Locale, EmailShellCopy> = {
  fr: {
    brandName: 'keimêlion',
    labelSeparator: ' :',
    fallbackLabel: 'Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :',
    signoff: 'À très vite,',
    signature: "L'équipe Keimêlion",
    tagline: "le trésor que l'on garde",
    publisher:
      'Keimêlion est édité par Alban Pierson, entrepreneur individuel, 6 rue Les Prérots, 70400 Couthenans, France.',
    contact: `Une question ? ${EMAIL_CONTACT_ADDRESS}`,
  },
  en: {
    brandName: 'keimêlion',
    labelSeparator: ':',
    fallbackLabel: 'Button not working? Copy this link into your browser:',
    signoff: 'See you soon,',
    signature: 'The Keimêlion team',
    tagline: 'the treasure you keep',
    publisher:
      'Keimêlion is published by Alban Pierson, sole trader, 6 rue Les Prérots, 70400 Couthenans, France.',
    contact: `Questions? ${EMAIL_CONTACT_ADDRESS}`,
  },
}
