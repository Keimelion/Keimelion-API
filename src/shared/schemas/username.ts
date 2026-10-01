import { z } from 'zod'
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_REGEX,
} from '../../features/users/users.constants.js'

export const usernameSchema = z
  .string()
  .trim()
  .regex(
    USERNAME_REGEX,
    `username must be ${String(USERNAME_MIN_LENGTH)}-${String(USERNAME_MAX_LENGTH)} letters, digits, underscores, or dashes`,
  )
