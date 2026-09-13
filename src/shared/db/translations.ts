import { pgEnum } from 'drizzle-orm/pg-core'
import { LOCALES } from '../enums/locale.js'

export const localeEnum = pgEnum('locale', LOCALES)
