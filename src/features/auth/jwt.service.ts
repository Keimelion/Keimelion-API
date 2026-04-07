import { SignJWT, jwtVerify } from 'jose'
import { env } from '../../config/env.js'
import { USER_ROLE_VALUES } from '../../shared/enums/user-role.js'
import type { UserRole } from '../../shared/enums/user-role.js'

const ALGORITHM = 'HS256'

export interface JwtPayload {
  userId: string
  role: UserRole
}

function encodeSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET)
}

export function signJwt(userId: string, role: UserRole): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(encodeSecret())
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret())
    const userId = payload.sub
    const role = payload.role
    if (!userId || !isValidRole(role)) return null
    return { userId, role }
  } catch {
    return null
  }
}

function isValidRole(value: unknown): value is UserRole {
  return USER_ROLE_VALUES.includes(value as UserRole)
}
