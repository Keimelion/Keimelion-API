import { describe, expect, it } from 'vitest'
import { renderEmail } from './email-shell.js'
import type { EmailShellContent } from './email-shell.js'
import { EMAIL_BANNER_COLORS, EmailBannerThemes } from './email-shell.theme.js'

const ACTION_URL = 'https://keimelion.test/confirm#token=abc'

const content: EmailShellContent = {
  locale: 'fr',
  subject: 'Sujet',
  preheader: 'Aperçu dans la boîte',
  bannerTheme: EmailBannerThemes.WAITLIST,
  kicker: 'presque emballé !',
  title: "Il ne reste qu'un clic.",
  paragraphs: ['Bonjour,', 'Premier paragraphe.'],
  action: { label: 'Confirmer', url: ACTION_URL },
  infoBox: { highlight: 'Valable 7 jours.', text: 'Ensuite, un seul e-mail.' },
  closingNote: 'Ignorez cet e-mail.',
  footerLinks: [
    { label: 'Politique de confidentialité', url: 'https://keimelion.test/privacy' },
    { label: 'Supprimer mon inscription', url: 'https://keimelion.test/delete#token=def' },
  ],
}

function indexesOf(html: string, fragments: string[]): number[] {
  return fragments.map((fragment) => html.indexOf(fragment))
}

describe('renderEmail', () => {
  it('renders the v2 modules in order', () => {
    const { html } = renderEmail(content)

    const positions = indexesOf(html, [
      'Aperçu dans la boîte',
      'keimêlion',
      EMAIL_BANNER_COLORS.waitlist,
      'presque emballé !',
      'Il ne reste qu&#39;un clic.',
      'Premier paragraphe.',
      '>Confirmer</a>',
      'Valable 7 jours.',
      'Le bouton ne fonctionne pas ?',
      'dashed',
      'Ignorez cet e-mail.',
      'L&#39;équipe Keimêlion',
      'le trésor que l&#39;on garde',
      'Alban Pierson',
      'contact@keimelion.app',
      'Supprimer mon inscription',
    ])
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
  })

  it('stays within what email clients render', () => {
    const { html } = renderEmail(content)

    expect(html).not.toMatch(/<svg|display:\s*flex|transform:|box-shadow|<script|@import|<link/)
    expect(html).toContain('role="presentation"')
    expect(html).not.toContain('border-bottom')
    expect(html).toContain('background: #6E0F2C; padding: 0 0 4px')
    expect(html).toContain('prefers-color-scheme: dark')
  })

  it('escapes every interpolated value', () => {
    const { html } = renderEmail({
      ...content,
      title: '<b>"Hi" & bye</b>',
      action: { label: 'Go', url: 'https://keimelion.test/?a=1&b="2"' },
    })

    expect(html).toContain('&lt;b&gt;&quot;Hi&quot; &amp; bye&lt;/b&gt;')
    expect(html).toContain('href="https://keimelion.test/?a=1&amp;b=&quot;2&quot;"')
    expect(html).not.toContain('<b>"Hi"')
  })

  it('repeats the button URL as the fallback link', () => {
    const { html } = renderEmail(content)

    expect(html.split(`href="${ACTION_URL}"`)).toHaveLength(3)
  })

  it('omits the optional info box and closing note', () => {
    const { html, text } = renderEmail({ ...content, infoBox: null, closingNote: null })

    expect(html).not.toContain('Valable 7 jours.')
    expect(html).not.toContain('Ignorez cet e-mail.')
    expect(text).not.toContain('Valable 7 jours.')
  })

  it('colours the banner after the email theme', () => {
    const { html } = renderEmail({ ...content, bannerTheme: EmailBannerThemes.LAUNCH })

    expect(html).toContain(`bgcolor="${EMAIL_BANNER_COLORS.launch}"`)
    expect(html).toContain('src="http://localhost:3000/assets/mail/banner-launch.png"')
  })

  it('scales the banner with its width so the illustration keeps its ratio on phones', () => {
    const { html } = renderEmail(content)
    const bannerImage = /<img src="[^"]*banner-waitlist\.png"[^>]*>/.exec(html)?.[0] ?? ''

    expect(bannerImage).toContain('width: 100%')
    expect(bannerImage).toContain('height: auto')
    expect(html).not.toMatch(/\.k-banner[^{]*\{[^}]*height/)
  })

  it('loads the logo mark and banner from the API email assets, as decorative images', () => {
    const { html } = renderEmail(content)

    expect(html).toContain('src="http://localhost:3000/assets/mail/banner-waitlist.png"')
    expect(html.split('src="http://localhost:3000/assets/mail/mark.png"')).toHaveLength(4)
    expect(html.match(/<img /g)).toHaveLength(4)
    expect(html.match(/<img [^>]*alt=""/g)).toHaveLength(4)
  })

  it('renders a plain-text version with the same content', () => {
    const { text, subject } = renderEmail(content)

    expect(subject).toBe('Sujet')
    expect(text).toBe(`Presque emballé !
Il ne reste qu'un clic.

Bonjour,

Premier paragraphe.

Confirmer :
${ACTION_URL}

Valable 7 jours.

Ensuite, un seul e-mail.

Ignorez cet e-mail.

À très vite,
L'équipe Keimêlion

—
Keimêlion est édité par Alban Pierson, entrepreneur individuel, 6 rue Les Prérots, 70400 Couthenans, France.
Une question ? contact@keimelion.app
Politique de confidentialité : https://keimelion.test/privacy
Supprimer mon inscription : https://keimelion.test/delete#token=def
`)
  })

  it('uses the English shell copy for an English email', () => {
    const { html, text } = renderEmail({ ...content, locale: 'en' })

    expect(html).toContain('<html lang="en">')
    expect(html).toContain('Button not working? Copy this link into your browser:')
    expect(text).toContain('See you soon,\nThe Keimêlion team')
    expect(text).toContain('Keimêlion is published by Alban Pierson')
  })
})
