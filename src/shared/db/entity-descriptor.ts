import { asc, desc, type AnyColumn, type SQL } from 'drizzle-orm'
import { buildGenericWhere } from './filter-where.js'
import { makeFilterValidator } from './filter-validator.js'
import { sortQuerySchema, type SortDirection } from '../schemas/sort.js'
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
  sortFields: readonly [TSortField, ...TSortField[]]
  buildListQuerySchema: () => ReturnType<typeof sortQuerySchema<TSortField>>
  buildWhere: (filters: FilterInput[]) => SQL | undefined
  buildOrderBy: (sort: SortSpec<TSortField> | undefined) => SQL[]
  validateFilters: (url: string) => FilterInput[] | null
}

export function defineEntity<
  TSortFields extends Readonly<Record<string, AnyColumn>>,
  TFilterFields extends Readonly<Record<string, FilterFieldConfig>>,
>(
  options: {
    sortable: TSortFields
    filterable: TFilterFields
    defaultSort: readonly SortSpec<keyof TSortFields & string>[]
  },
): EntityDescriptor<keyof TSortFields & string, keyof TFilterFields & string> {
  type TSortField = keyof TSortFields & string
  type TFilterField = keyof TFilterFields & string

  const sortFields = Object.keys(options.sortable) as [TSortField, ...TSortField[]]
  const sortable = options.sortable as Readonly<Record<TSortField, AnyColumn>>
  const filterable = options.filterable as FilterConfig<Record<TFilterField, unknown>>
  const validator = makeFilterValidator(filterable)

  return {
    sortable,
    filterable,
    defaultSort: options.defaultSort,
    sortFields,
    buildListQuerySchema: () => sortQuerySchema(sortFields),
    buildWhere: (filters) => buildGenericWhere(filterable, filters),
    buildOrderBy: (sort) => buildOrderBySql(sortable, options.defaultSort, sort),
    validateFilters: (url) => validator(url),
  }
}

function buildOrderBySql<TSortField extends string>(
  sortable: Readonly<Record<TSortField, AnyColumn>>,
  defaultSort: readonly SortSpec<TSortField>[],
  sort: SortSpec<TSortField> | undefined,
): SQL[] {
  const specs = sort !== undefined ? [sort] : defaultSort
  return specs.map((spec) => (spec.direction === 'asc' ? asc : desc)(sortable[spec.field]))
}
