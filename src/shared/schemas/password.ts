import { z } from 'zod'
import { MAX_PASSWORD_LENGTH } from '../../features/users/users.constants.js'

export const passwordSchema = z.string().min(8).max(MAX_PASSWORD_LENGTH)
