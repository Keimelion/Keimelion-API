import { z } from 'zod'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface SlugSchemaOptions {
  min: number
  max: number
  example: string
}

export function createSlugSchema({ min, max, example }: SlugSchemaOptions): z.ZodString {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .regex(SLUG_REGEX, `slug must be lowercase letters, digits, and dashes (e.g. ${example})`)
}
