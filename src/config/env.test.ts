import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MailProviderNames } from '../shared/enums/mail-provider.js'
import { NodeEnvs } from '../shared/enums/node-env.js'

const EXIT_ERROR = 'process.exit called'
const API_KEY = 'test-provider-key'
const FROM = 'noreply@keimelion.app'

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

  it('boots in production with a key and a sender', async () => {
    await expect(
      loadEnv({ NODE_ENV: NodeEnvs.PRODUCTION, EMAIL_API_KEY: API_KEY, EMAIL_FROM: FROM }),
    ).resolves.toBeUndefined()
  })

  it.each([
    ['EMAIL_API_KEY', { EMAIL_API_KEY: NO_VALUE, EMAIL_FROM: FROM }],
    ['EMAIL_FROM', { EMAIL_API_KEY: API_KEY, EMAIL_FROM: NO_VALUE }],
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
})
