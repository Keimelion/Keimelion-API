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
pair it allows. The Zod schema builder derives a strict schema from this config
by generating one `z.object({ field: literal, operator: literal, value: <per-op shape> })`
per allowed pair and combining them into a `z.union`. Any `(field, op)` pair not in
the config — and any value that doesn't match its operator's shape (e.g. `between`
with a single scalar, `isNull` with `"whatever"`, `in` with a scalar) — is rejected
with a 422 before it reaches the WHERE builder. No field name from a filter query
ever touches the database without going through this whitelist first.

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

### Backward-compat for `/v1/admin/users` (TBD resolved)

**Decision**: the named-filter Zod schema in `list-users.ts` remains unchanged,
and the existing `buildUsersWhere` in `admin-users.repository.ts` keeps its
named-filter branches. In parallel, a new `usersGenericFilterConfig` is added
to the repository; when the request carries bracket-syntax filters, they are
parsed, whitelisted through the generic Zod schema, then combined into the
same `AND` alongside the named filters via `buildGenericWhere`.

Named and bracket filters therefore live side by side in the same WHERE
clause — named filters still map through their dedicated helpers
(`nullnessFlag`, `stringContains`, direct `eq/gte/lte`), while any new filter
capability should be added exclusively to the generic framework so it is not
duplicated on both sides. A follow-up ticket can migrate remaining named
filters to the generic layer once the Backoffice has moved off them.

---

## Consequences

- Adding a new filterable field to a list endpoint now requires only adding an
  entry to the endpoint's `FilterConfig` — no new Zod field, no new WHERE branch.
- The bracket-syntax query string is not handled by Hono's built-in parser; the
  endpoint must call `parseFilterQuery(context.req.url)` to extract generic filters.
- The `qs` library is added as a production dependency (small footprint, widely used).
- Named filters for `/v1/admin/users` continue to work indefinitely. A future
  ticket can remove them once the Backoffice has fully migrated to bracket syntax.
