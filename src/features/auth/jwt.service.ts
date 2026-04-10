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

function encodeSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET)
}

export function signJwt(userId: string, role: UserRole): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .setJti(randomUUID())
    .sign(encodeSecret())
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

function isValidRole(value: unknown): value is UserRole {
  return USER_ROLE_VALUES.includes(value as UserRole)
}
