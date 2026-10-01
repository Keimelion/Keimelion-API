import { z } from 'zod'

export function urlSchema(fieldName: string) {
  return z.string().url(`${fieldName} must be a valid URL`)
}

export function httpsUrlSchema(fieldName: string, maxLength: number) {
  return urlSchema(fieldName)
    .max(maxLength)
    .refine((value) => value.startsWith('https://'), `${fieldName} must use HTTPS`)
}
