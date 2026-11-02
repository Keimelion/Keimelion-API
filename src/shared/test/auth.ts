import { SignJWT } from 'jose'
import type { UserRole } from '../enums/user-role.js'

export const TEST_JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'
export const TEST_JTI = '00000000-0000-0000-0000-000000000099'

interface GenerateTokenOptions {
  role?: UserRole
  includeJti?: boolean
  expired?: boolean
}

export async function generateTestToken(userId: string, options: GenerateTokenOptions = {}): Promise<string> {
  const { role = 'user', includeJti = true, expired = false } = options
  const secret = new TextEncoder().encode(TEST_JWT_SECRET)
  const now = Math.floor(Date.now() / 1000)
  const builder = new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(expired ? now - 7200 : now)
    .setExpirationTime(expired ? now - 3600 : now + 3600)
  if (includeJti) {
    builder.setJti(TEST_JTI)
  }
  return builder.sign(secret)
}

export interface TestAccessTokenEntry {
  tokenId: string
  userId: string
  expiresAt: Date
}

export function makeAccessTokenEntry(userId: string): TestAccessTokenEntry {
  return { tokenId: TEST_JTI, userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }
}
