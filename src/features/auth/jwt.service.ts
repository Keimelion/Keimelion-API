import { randomUUID } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../../config/env.js'
import { USER_ROLE_VALUES } from '../../shared/enums/user-role.js'
import type { UserRole } from '../../shared/enums/user-role.js'

const ALGORITHM = 'HS256'

export interface JwtPayload {
  userId: string
  role: UserRole
  jti: string | null
  exp: number | null
}

export interface SignedToken {
  token: string
  jti: string
  expiresAt: Date
}

export async function signJwt(userId: string, role: UserRole): Promise<SignedToken> {
  const jti = randomUUID()
  const expiresAt = computeExpiresAt(env.JWT_EXPIRES_IN)
  const token = await new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .setJti(jti)
    .sign(encodeSecret())
  return { token, jti, expiresAt }
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret())
    const userId = payload.sub
    const role = payload.role
    if (!userId || !isValidRole(role)) return null
    return {
      userId,
      role,
      jti: typeof payload.jti === 'string' ? payload.jti : null,
      exp: typeof payload.exp === 'number' ? payload.exp : null,
    }
  } catch {
    return null
  }
}

function encodeSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET)
}

function computeExpiresAt(expiresIn: string): Date {
  const units: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  const match = /^(\d+)([smhd])$/.exec(expiresIn)
  const value = match?.[1]
  const unit = match?.[2]
  const multiplier = unit !== undefined ? units[unit] : undefined
  if (!value || multiplier === undefined) throw new Error(`Invalid JWT_EXPIRES_IN: ${expiresIn}`)
  return new Date(Date.now() + parseInt(value, 10) * multiplier)
}

function isValidRole(value: unknown): value is UserRole {
  return USER_ROLE_VALUES.includes(value as UserRole)
}
