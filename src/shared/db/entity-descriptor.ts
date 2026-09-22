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

interface DefineEntityOptions<TSortField extends string, TFilterField extends string> {
  sortable: Readonly<Record<TSortField, AnyColumn>>
  filterable: Readonly<Record<TFilterField, FilterableField>>
  defaultSort: { field: TSortField; direction: SortDirection }
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

  const filterConfig = buildFilterConfigFromFilterable(
    options.filterable as Readonly<Record<TFilterField, FilterableField>>,
  )

  const validator = makeFilterValidator(filterConfig)

  const descriptor: DefineEntityOptions<TSortField, TFilterField> = {
    sortable: options.sortable as Readonly<Record<TSortField, AnyColumn>>,
    filterable: options.filterable as Readonly<Record<TFilterField, FilterableField>>,
    defaultSort: options.defaultSort,
  }

  return {
    sortable: descriptor.sortable,
    filterable: descriptor.filterable,
    defaultSort: descriptor.defaultSort,
    filterConfig,
    sortFields,
    buildListQuerySchema: () => sortQuerySchema(sortFields),
    buildWhere: (filters) => buildGenericWhere(filterConfig, filters),
    buildOrderBy: (sort) => buildOrderByFromDescriptor(descriptor, sort),
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

function buildOrderByFromDescriptor<TSortField extends string, TFilterField extends string>(
  descriptor: DefineEntityOptions<TSortField, TFilterField>,
  sort: { field: TSortField; direction: SortDirection } | undefined,
): SQL {
  const field = sort?.field ?? descriptor.defaultSort.field
  const direction = sort?.direction ?? descriptor.defaultSort.direction
  const column = descriptor.sortable[field]
  const orderFn = direction === 'asc' ? asc : desc
  return orderFn(column)
}

export function buildListQuerySchema<TSortField extends string, TFilterField extends string>(
  entity: EntityDescriptor<TSortField, TFilterField>,
): ReturnType<typeof sortQuerySchema<TSortField>> {
  return entity.buildListQuerySchema()
}

export function buildListWhere<TSortField extends string, TFilterField extends string>(
  entity: EntityDescriptor<TSortField, TFilterField>,
  filters: FilterInput[],
): SQL | undefined {
  return entity.buildWhere(filters)
}

export function buildOrderBy<TSortField extends string, TFilterField extends string>(
  entity: EntityDescriptor<TSortField, TFilterField>,
  sort: { field: TSortField; direction: SortDirection } | undefined,
): SQL {
  return entity.buildOrderBy(sort)
}
