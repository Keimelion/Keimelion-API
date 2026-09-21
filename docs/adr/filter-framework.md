# ADR: Operator-based generic filter framework for list endpoints

**Status**: Accepted  
**Date**: 2026-09-21  
**Ticket**: KEI-49

---

## Context

List endpoints previously exposed filters as fixed named query params
(`?isBanned=true`, `?createdFrom=...`, `?email=...`). Each filter was hardcoded in
the endpoint's Zod schema and mapped 1:1 to a SQL expression in the repository.

This approach does not scale: every new filterable field requires a new Zod field,
a new WHERE branch, and a new test. It also makes it impossible to build a
Retool/Metabase-style back-office where admins compose their own filters.

---

## Decision

Design a generic operator-based filter framework that:

1. Lets each endpoint declare a `FilterConfig<TEntity>` whitelist of `(field, operator)` pairs.
2. Parses bracket-nested query strings (`?email[eq]=foo&createdAt[gte]=2024-01-01`) via the `qs` library.
3. Validates the parsed filters against the whitelist using a derived Zod schema.
4. Builds a Drizzle `SQL` `WHERE` clause by dispatching on operator type.

### Supported operators

| Operator | Meaning | SQL equivalent |
|---|---|---|
| `eq` | Exact match | `= $value` |
| `in` | Set membership | `IN ($values)` |
| `gte` | Greater-than-or-equal | `>= $value` |
| `lte` | Less-than-or-equal | `<= $value` |
| `between` | Inclusive range | `BETWEEN $min AND $max` |
| `ilike` | Case-insensitive substring | `ILIKE '%$value%'` |
| `isNull` | Nullness test | `IS NULL` / `IS NOT NULL` |

### File layout

```
src/shared/db/
  filter-config.ts    — FilterConfig<TEntity> type + operator literal types
  filter-parser.ts    — bracket-nested query parser (qs-based)
  filter-schema.ts    — Zod schema builder derived from a FilterConfig
  filter-where.ts     — Drizzle WHERE builder dispatching on operator
src/shared/db/filters.test.ts  — unit tests (all ops + whitelist rejection)
```

The existing `src/shared/db/filters.ts` (which contains the `nullnessFlag` and
`stringContains` helpers) is **preserved unchanged**. The new framework is additive.

### Whitelist enforcement

The `FilterConfig<TEntity>` for each endpoint explicitly enumerates every `(field, op)`
pair it allows. The Zod schema builder derives a strict schema from this config,
so any `(field, op)` pair not in the config is rejected with a 422 before it reaches
the WHERE builder. No field name from a filter query ever touches the database
without going through this whitelist first.

Internal fields (`passwordHash`, `emailVerifyToken`, `emailVerifyTokenExpiresAt`,
`passwordResetToken`, `passwordResetTokenExpiresAt`) must never be present in any
`FilterConfig` definition. This is a convention enforced by code review, not by
the type system (the type system allows any column the caller references).

### Migration path — hybrid (TBD resolved)

**Decision**: adopt the **hybrid** strategy — keep all existing named filter params
(`?email=`, `?isBanned=`, `?createdFrom=`, `?createdTo=`, `?role=`) working
as-is, and additionally accept the new bracket syntax (`?email[ilike]=`,
`?bannedAt[isNull]=`, `?createdAt[gte]=`, `?createdAt[lte]=`, `?role[eq]=`).

Rationale:
- Zero breaking change for any existing API consumer or test.
- The Backoffice can migrate to the bracket syntax at its own pace.
- Both syntaxes feed into the same `buildGenericWhere` function via
  `buildUsersGenericFilters()`, so there is no duplicated SQL logic.

### Backward-compat for `/v1/admin/users` (TBD resolved)

**Decision**: the named-filter Zod schema in `list-users.ts` remains unchanged.
A new `usersGenericFilterConfig` is introduced in `admin-users.repository.ts`
alongside a `buildUsersGenericFilters` helper that translates both the named
query params and any bracket-syntax params into a single `FilterInput[]` array,
then passes it to `buildGenericWhere`.

The old `buildUsersWhere` function is replaced by `buildUsersGenericFilters` +
`buildGenericWhere`, so all named filters now route through the generic WHERE
builder. This makes the migration transparent: existing tests continue to pass,
and new bracket-syntax tests demonstrate the new capability.

---

## Consequences

- Adding a new filterable field to a list endpoint now requires only adding an
  entry to the endpoint's `FilterConfig` — no new Zod field, no new WHERE branch.
- The bracket-syntax query string is not handled by Hono's built-in parser; the
  endpoint must call `parseFilterQuery(context.req.url)` to extract generic filters.
- The `qs` library is added as a production dependency (small footprint, widely used).
- Named filters for `/v1/admin/users` continue to work indefinitely. A future
  ticket can remove them once the Backoffice has fully migrated to bracket syntax.
