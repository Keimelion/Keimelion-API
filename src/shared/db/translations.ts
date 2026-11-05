import { pgEnum } from 'drizzle-orm/pg-core'
import { LOCALES } from '@keimelion/sdk/enums'

export const localeEnum = pgEnum('locale', LOCALES)
