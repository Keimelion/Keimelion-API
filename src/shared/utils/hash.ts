import bcrypt from 'bcryptjs'
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { env } from '../../config/env.js'

// Width of a sha256 digest encoded as hex — the stored width of every hashed token column.
export const SHA256_HEX_LENGTH = 64

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function hashSha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// Deterministic token derived from a secret: 32 bytes, i.e. 43 base64url characters.
export function hmacSha256Base64Url(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

// Constant-time comparison of a raw value against a stored sha256 hex digest. A malformed
// stored hash (wrong width) is rejected up front since timingSafeEqual throws on length mismatch.
export function matchesSha256Hex(value: string, storedHash: string): boolean {
  if (storedHash.length !== SHA256_HEX_LENGTH) return false
  return timingSafeEqual(Buffer.from(hashSha256Hex(value)), Buffer.from(storedHash))
}
