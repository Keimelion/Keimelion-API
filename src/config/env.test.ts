import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MailProviderNames } from '../shared/enums/mail-provider.js'
import { NodeEnvs } from '../shared/enums/node-env.js'

const EXIT_ERROR = 'process.exit called'
const API_KEY = 'test-provider-key'
const FROM = 'noreply@keimelion.app'
const PUBLIC_LANDING_URL = 'https://keimelion.app'
const REAL_SENDING = { EMAIL_API_KEY: API_KEY, EMAIL_FROM: FROM, LANDING_URL: PUBLIC_LANDING_URL }

// Blank rather than unset: dotenv would otherwise fill the value from a developer's local .env.
const NO_VALUE = ''

async function loadEnv(mailSettings: Record<string, string>): Promise<void> {
  vi.stubEnv('DATABASE_URL', 'postgres://localhost/test')
  vi.stubEnv('JWT_SECRET', 'a'.repeat(32))
  for (const [key, value] of Object.entries(mailSettings)) vi.stubEnv(key, value)
  await vi.importActual('./env.js')
}

describe('env mail settings', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error(EXIT_ERROR)
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('boots in production with a key, a sender and a public landing URL', async () => {
    await expect(
      loadEnv({ NODE_ENV: NodeEnvs.PRODUCTION, ...REAL_SENDING }),
    ).resolves.toBeUndefined()
  })

  it.each([
    ['EMAIL_API_KEY', { ...REAL_SENDING, EMAIL_API_KEY: NO_VALUE }],
    ['EMAIL_FROM', { ...REAL_SENDING, EMAIL_FROM: NO_VALUE }],
    ['LANDING_URL', { ...REAL_SENDING, LANDING_URL: 'http://localhost:4321' }],
  ])('refuses to boot in production without %s', async (missingKey, mailSettings) => {
    await expect(loadEnv({ NODE_ENV: NodeEnvs.PRODUCTION, ...mailSettings })).rejects.toThrow(
      EXIT_ERROR,
    )

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(missingKey))
  })

  it('boots in production without key or sender when the provider is log', async () => {
    await expect(
      loadEnv({
        NODE_ENV: NodeEnvs.PRODUCTION,
        EMAIL_PROVIDER: MailProviderNames.LOG,
        EMAIL_API_KEY: NO_VALUE,
        EMAIL_FROM: NO_VALUE,
      }),
    ).resolves.toBeUndefined()
  })

  it('boots outside production without key or sender', async () => {
    await expect(
      loadEnv({
        NODE_ENV: NodeEnvs.DEVELOPMENT,
        EMAIL_API_KEY: NO_VALUE,
        EMAIL_FROM: NO_VALUE,
      }),
    ).resolves.toBeUndefined()
  })

  it('boots in production with a local landing URL when the provider is log', async () => {
    await expect(
      loadEnv({
        NODE_ENV: NodeEnvs.PRODUCTION,
        EMAIL_PROVIDER: MailProviderNames.LOG,
        LANDING_URL: 'http://localhost:4321',
      }),
    ).resolves.toBeUndefined()
  })

  it('treats a blank MAIL_TEST_TO as unset and rejects a malformed one', async () => {
    await expect(loadEnv({ MAIL_TEST_TO: NO_VALUE })).resolves.toBeUndefined()

    vi.resetModules()
    await expect(loadEnv({ MAIL_TEST_TO: 'not-an-email' })).rejects.toThrow(EXIT_ERROR)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('MAIL_TEST_TO'))
  })
})
