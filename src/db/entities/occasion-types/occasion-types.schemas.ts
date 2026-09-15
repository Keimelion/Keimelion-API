import { z } from 'zod'
import { LOCALES } from '../../../shared/enums/locale.js'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MIN_SLUG_LENGTH = 2
const MAX_SLUG_LENGTH = 60

const MIN_EMOJI_LENGTH = 1
const MAX_EMOJI_LENGTH = 10

const MIN_LABEL_LENGTH = 1
const MAX_LABEL_LENGTH = 100

const MIN_SORT_ORDER = 0
const MAX_SORT_ORDER = 32767

export const slugSchema = z
  .string()
  .trim()
  .regex(SLUG_REGEX)
  .min(MIN_SLUG_LENGTH)
  .max(MAX_SLUG_LENGTH)

export const emojiSchema = z.string().trim().min(MIN_EMOJI_LENGTH).max(MAX_EMOJI_LENGTH)

export const labelSchema = z.string().trim().min(MIN_LABEL_LENGTH).max(MAX_LABEL_LENGTH)

export const sortOrderSchema = z.number().int().min(MIN_SORT_ORDER).max(MAX_SORT_ORDER)

export const localeSchema = z.enum(LOCALES)

export function hasUniqueLocales(arr: readonly { locale: string }[]): boolean {
  return new Set(arr.map((entry) => entry.locale)).size === arr.length
}
