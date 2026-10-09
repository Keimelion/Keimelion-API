import { z } from 'zod'
import { MAX_TAG_NAME_LENGTH, MAX_TAG_SLUG_LENGTH } from './tags.schema.js'

const MIN_TAG_NAME_LENGTH = 1
const MIN_TAG_SLUG_LENGTH = 1

const TAG_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const tagNameSchema = z
  .string()
  .trim()
  .min(MIN_TAG_NAME_LENGTH)
  .max(MAX_TAG_NAME_LENGTH)

export const tagSlugSchema = z
  .string()
  .trim()
  .min(MIN_TAG_SLUG_LENGTH)
  .max(MAX_TAG_SLUG_LENGTH)
  .regex(TAG_SLUG_REGEX, 'slug must be lowercase letters, digits, and dashes (e.g. gaming)')
