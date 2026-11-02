import { parseFilterQuery } from './filter-parser.js'
import { buildFilterSchema } from './filter-schema.js'
import type { FilterConfig } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

export function makeFilterValidator<TEntity>(
  config: FilterConfig<TEntity>,
): (url: string) => FilterInput[] | null {
  const schema = buildFilterSchema(config)
  return (url) => {
    const parsed = parseFilterQuery(url)
    const result = schema.safeParse(parsed)
    return result.success ? result.data : null
  }
}
