import { randomBytes, timingSafeEqual } from 'crypto'
import { hashSha256Hex } from '../../shared/utils/hash.js'
import { RESERVATION_TOKEN_BYTE_LENGTH, RESERVATION_TOKEN_PREFIX } from './reservations.constants.js'

const BEARER_PREFIX = `Bearer ${RESERVATION_TOKEN_PREFIX}`
const SHA256_BYTE_LENGTH = 32

export interface GeneratedReservationToken {
  rawToken: string
  tokenHash: string
}

export function generateReservationToken(): GeneratedReservationToken {
  const rawToken = `${RESERVATION_TOKEN_PREFIX}${randomBytes(RESERVATION_TOKEN_BYTE_LENGTH).toString('base64url')}`
  return { rawToken, tokenHash: hashSha256Hex(rawToken) }
}

export function extractReservationToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) return null
  return authorizationHeader.slice('Bearer '.length)
}

export function isReservationTokenMatch(rawToken: string, storedTokenHash: string): boolean {
  const candidate = Buffer.from(hashSha256Hex(rawToken), 'hex')
  const stored = Buffer.from(storedTokenHash, 'hex')
  if (candidate.length !== SHA256_BYTE_LENGTH || stored.length !== SHA256_BYTE_LENGTH) return false
  return timingSafeEqual(candidate, stored)
}
