import { asc, desc, type AnyColumn, type SQL } from 'drizzle-orm'
import type { SortDirection, SortInput } from '../schemas/sort.js'

export interface SortConfig<TField extends string> {
  columns: Readonly<Record<TField, AnyColumn>>
  defaultField: TField
  defaultDirection: SortDirection
}

export function buildOrderBy<TField extends string>(
  config: SortConfig<TField>,
  sort: SortInput<TField> | undefined,
): SQL {
  const field = sort?.field ?? config.defaultField
  const direction = sort?.direction ?? config.defaultDirection
  const orderFn = direction === 'asc' ? asc : desc
  return orderFn(config.columns[field])
}
