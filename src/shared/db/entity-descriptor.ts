import { asc, desc, type AnyColumn, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { buildGenericWhere } from './filter-where.js'
import { makeFilterValidator } from './filter-validator.js'
import { sortQuerySchema, type SortDirection } from '../schemas/sort.js'
import type { FilterConfig, FilterFieldConfig, FilterOperator, FilterValueType } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

export interface FilterableField {
  column: AnyColumn
  operators: readonly [FilterOperator, ...FilterOperator[]]
  valueType?: FilterValueType
  valueSchema?: z.ZodType<string>
}

export interface EntityDescriptor<
  TSortField extends string,
  TFilterField extends string,
> {
  sortable: Readonly<Record<TSortField, AnyColumn>>
  filterable: Readonly<Record<TFilterField, FilterableField>>
  defaultSort: { field: TSortField; direction: SortDirection }
  filterConfig: FilterConfig<Record<TFilterField, unknown>>
  sortFields: readonly [TSortField, ...TSortField[]]
  buildListQuerySchema: () => ReturnType<typeof sortQuerySchema<TSortField>>
  buildWhere: (filters: FilterInput[]) => SQL | undefined
  buildOrderBy: (sort: { field: TSortField; direction: SortDirection } | undefined) => SQL
  validateFilters: (url: string) => FilterInput[] | null
}

export function defineEntity<
  TSortFields extends Readonly<Record<string, AnyColumn>>,
  TFilterFields extends Readonly<Record<string, FilterableField>>,
>(
  options: {
    sortable: TSortFields
    filterable: TFilterFields
    defaultSort: { field: keyof TSortFields & string; direction: SortDirection }
  },
): EntityDescriptor<keyof TSortFields & string, keyof TFilterFields & string> {
  type TSortField = keyof TSortFields & string
  type TFilterField = keyof TFilterFields & string

  const sortFields = Object.keys(options.sortable) as [TSortField, ...TSortField[]]
  const sortable = options.sortable as Readonly<Record<TSortField, AnyColumn>>
  const filterable = options.filterable as Readonly<Record<TFilterField, FilterableField>>
  const filterConfig = buildFilterConfigFromFilterable(filterable)
  const validator = makeFilterValidator(filterConfig)

  return {
    sortable,
    filterable,
    defaultSort: options.defaultSort,
    filterConfig,
    sortFields,
    buildListQuerySchema: () => sortQuerySchema(sortFields),
    buildWhere: (filters) => buildGenericWhere(filterConfig, filters),
    buildOrderBy: (sort) => buildOrderBySql(sortable, options.defaultSort, sort),
    validateFilters: (url) => validator(url),
  }
}

function buildFilterConfigFromFilterable<TFilterField extends string>(
  filterable: Readonly<Record<TFilterField, FilterableField>>,
): FilterConfig<Record<TFilterField, unknown>> {
  return Object.fromEntries(
    Object.entries(filterable).map(([key, field]) => {
      const filterableField = field as FilterableField
      const fieldConfig: FilterFieldConfig = {
        column: filterableField.column,
        operators: filterableField.operators,
        ...(filterableField.valueType !== undefined ? { valueType: filterableField.valueType } : {}),
        ...(filterableField.valueSchema !== undefined ? { valueSchema: filterableField.valueSchema } : {}),
      }
      return [key, fieldConfig]
    }),
  ) as FilterConfig<Record<TFilterField, unknown>>
}

function buildOrderBySql<TSortField extends string>(
  sortable: Readonly<Record<TSortField, AnyColumn>>,
  defaultSort: { field: TSortField; direction: SortDirection },
  sort: { field: TSortField; direction: SortDirection } | undefined,
): SQL {
  const field = sort?.field ?? defaultSort.field
  const direction = sort?.direction ?? defaultSort.direction
  const orderFn = direction === 'asc' ? asc : desc
  return orderFn(sortable[field])
}
