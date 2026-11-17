import { asc, isNull, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { buildGenericWhere } from './filter-where.js'
import { makeFilterValidator } from './filter-validator.js'
import type { SortDirection } from '@keimelion/sdk/schemas'
import type { FilterConfig, FilterFieldConfig } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

export interface SortSpec<TSortField extends string> {
  field: TSortField
  direction: SortDirection
}

export interface EntityDescriptor<
  TSortField extends string,
  TFilterField extends string,
> {
  sortable: Readonly<Record<TSortField, AnyColumn>>
  filterable: FilterConfig<Record<TFilterField, unknown>>
  defaultSort: readonly SortSpec<TSortField>[]
  buildWhere: (filters: FilterInput[]) => SQL | undefined
  buildOrderBy: (sort: SortSpec<TSortField> | undefined) => SQL[]
  validateFilters: (url: string) => FilterInput[] | null
}

export function defineEntity<
  TSortFields extends Readonly<Record<string, AnyColumn>>,
  TFilterFields extends Readonly<Record<string, FilterFieldConfig>>,
>(
  options: {
    idColumn: AnyColumn
    sortable: TSortFields
    filterable: TFilterFields
    defaultSort: readonly SortSpec<keyof TSortFields & string>[]
  },
): EntityDescriptor<keyof TSortFields & string, keyof TFilterFields & string> {
  type TSortField = keyof TSortFields & string
  type TFilterField = keyof TFilterFields & string

  const sortable = options.sortable as Readonly<Record<TSortField, AnyColumn>>
  const filterable = options.filterable as FilterConfig<Record<TFilterField, unknown>>
  const validator = makeFilterValidator(filterable)

  return {
    sortable,
    filterable,
    defaultSort: options.defaultSort,
    buildWhere: (filters) => buildGenericWhere(filterable, filters),
    buildOrderBy: (sort) =>
      buildOrderBySql({ sortable, defaultSort: options.defaultSort, idColumn: options.idColumn }, sort),
    validateFilters: (url) => validator(url),
  }
}

interface OrderByConfig<TSortField extends string> {
  sortable: Readonly<Record<TSortField, AnyColumn>>
  defaultSort: readonly SortSpec<TSortField>[]
  idColumn: AnyColumn
}

function buildOrderBySql<TSortField extends string>(
  config: OrderByConfig<TSortField>,
  sort: SortSpec<TSortField> | undefined,
): SQL[] {
  const specs = sort !== undefined ? [sort] : config.defaultSort
  const sortClauses = specs.map((spec) => orderNullsLast(config.sortable[spec.field], spec.direction))
  return [...sortClauses, asc(config.idColumn)]
}

function orderNullsLast(column: AnyColumn, direction: SortDirection): SQL {
  return direction === 'asc' ? sql`${column} asc nulls last` : sql`${column} desc nulls last`
}

export function buildSoftDeleteDefault(
  genericFilters: FilterInput[],
  deletedAtColumn: AnyColumn,
): SQL | undefined {
  const hasDeletedAtFilter = genericFilters.some((filter) => filter.field === 'deletedAt')
  return hasDeletedAtFilter ? undefined : isNull(deletedAtColumn)
}
