import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { env } from '../../config/env.js'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function hashSha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
