// Values from the KEI-164 v2 email design. Web fonts are progressive enhancement only: they are
// never loaded remotely (a font request would disclose the recipient's IP to a third party).
export const EmailColors = {
  BACKGROUND: '#F3EAD9',
  CARD: '#FFFAF0',
  INK: '#1C1A33',
  INK_MUTED: '#5A5570',
  BRAND: '#B3204C',
  BRAND_DEEP: '#6E0F2C',
  ON_BRAND: '#FFFAF0',
  LINK: '#2B45B8',
  RULE: '#E6DCC7',
  INFO_BADGE: '#F2BF3D',
} as const

export const EmailDarkColors = {
  BACKGROUND: '#15131F',
  CARD: '#211E2E',
  INK: '#F4ECDF',
  INK_MUTED: '#B3ACC0',
  LINK: '#93A8FF',
  BRAND: '#F7B8C8',
  RULE: '#3A3550',
} as const

export const EmailFonts = {
  DISPLAY: "'Bricolage Grotesque', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  SANS: "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  HANDWRITTEN: "'Caveat', Georgia, 'Times New Roman', serif",
  MONO: "'DM Mono', ui-monospace, Menlo, monospace",
} as const

export const EmailBannerThemes = {
  WAITLIST: 'waitlist',
  RESERVATION: 'reservation',
  ACCOUNT: 'account',
  LAUNCH: 'launch',
} as const

export type EmailBannerTheme = (typeof EmailBannerThemes)[keyof typeof EmailBannerThemes]

export const EMAIL_BANNER_COLORS: Record<EmailBannerTheme, string> = {
  [EmailBannerThemes.WAITLIST]: '#CDB8F5',
  [EmailBannerThemes.RESERVATION]: '#A8E0C0',
  [EmailBannerThemes.ACCOUNT]: '#9FCBF2',
  [EmailBannerThemes.LAUNCH]: '#F2BF3D',
}
