import { describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { userListsEntity } from '../../features/lists/lists.repository.js'
import { listsEntity } from '../../features/admin/lists/admin-lists.repository.js'
import { adminReservationsEntity } from '../../features/admin/reservations/admin-reservations.repository.js'
import { userReservationsEntity } from '../../db/entities/reservations/reservations.repository.js'
import { tagsEntity } from '../../features/admin/tags/admin-tags.repository.js'
import { feedbackEntity } from '../../features/admin/feedback/admin-feedback.repository.js'
import { shopsEntity } from '../../features/admin/shops/admin-shops.repository.js'
import { itemsEntity } from '../../features/admin/items/admin-items.repository.js'
import { usersEntity } from '../../features/admin/users/admin-users.repository.js'
import { reportEntity } from '../../features/admin/reports/admin-reports.repository.js'

function renderOrderBy(clauses: SQL[]): string[] {
  const dialect = new PgDialect()
  return clauses.map((clause) => dialect.sqlToQuery(clause).sql)
}

describe('defineEntity buildOrderBy', () => {
  it('sorts lists by eventDate ascending with nulls last and an id tiebreaker', () => {
    const orderBy = userListsEntity.buildOrderBy({ field: 'eventDate', direction: 'asc' })

    expect(renderOrderBy(orderBy)).toEqual([
      '"lists"."event_date" asc nulls last',
      '"lists"."id" asc',
    ])
  })

  it('keeps nulls last when sorting lists by eventDate descending', () => {
    const orderBy = userListsEntity.buildOrderBy({ field: 'eventDate', direction: 'desc' })

    expect(renderOrderBy(orderBy)).toEqual([
      '"lists"."event_date" desc nulls last',
      '"lists"."id" asc',
    ])
  })

  it('falls back to the default sort, still ending with the id tiebreaker', () => {
    expect(renderOrderBy(userListsEntity.buildOrderBy(undefined))).toEqual([
      '"lists"."created_at" desc nulls last',
      '"lists"."id" asc',
    ])
  })

  it.each([
    ['admin lists', listsEntity, 'lists'],
    ['admin reservations', adminReservationsEntity, 'reservations'],
    ['user reservations', userReservationsEntity, 'reservations'],
    ['admin tags', tagsEntity, 'tags'],
    ['admin feedback', feedbackEntity, 'feedback'],
    ['admin shops', shopsEntity, 'shops'],
    ['admin items', itemsEntity, 'items'],
    ['admin users', usersEntity, 'users'],
    ['admin reports', reportEntity, 'reports'],
  ])('ends the %s default ORDER BY with nulls last and its own id', (_, entity, table) => {
    const rendered = renderOrderBy(entity.buildOrderBy(undefined))

    expect(rendered.slice(0, -1).every((clause) => clause.endsWith(' nulls last'))).toBe(true)
    expect(rendered.at(-1)).toBe(`"${table}"."id" asc`)
  })
})
