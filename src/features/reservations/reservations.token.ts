import { randomBytes } from 'crypto'
import { extractBearerToken } from '../../shared/utils/bearer.js'
import { hashSha256Hex, matchesSha256Hex } from '../../shared/utils/hash.js'
import { RESERVATION_TOKEN_BYTE_LENGTH, RESERVATION_TOKEN_PREFIX } from './reservations.constants.js'

interface GeneratedReservationToken {
  rawToken: string
  tokenHash: string
}

export function generateReservationToken(): GeneratedReservationToken {
  const rawToken = `${RESERVATION_TOKEN_PREFIX}${randomBytes(RESERVATION_TOKEN_BYTE_LENGTH).toString('base64url')}`
  return { rawToken, tokenHash: hashSha256Hex(rawToken) }
}

export function extractReservationToken(authorizationHeader: string | undefined): string | null {
  const token = extractBearerToken(authorizationHeader)
  if (!token?.startsWith(RESERVATION_TOKEN_PREFIX)) return null
  return token
}

export function isReservationTokenMatch(rawToken: string, storedTokenHash: string): boolean {
  return matchesSha256Hex(rawToken, storedTokenHash)
}
