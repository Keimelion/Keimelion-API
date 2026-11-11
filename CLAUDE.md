# Keimelion API — Claude context

## Project

REST API for Keimelion, a collaborative wishlist app. Built with Hono on Node.js, PostgreSQL via Drizzle ORM.

## Stack

- **Runtime**: Node.js (ESM, `"type": "module"`)
- **Framework**: Hono
- **ORM**: Drizzle ORM + `postgres` driver
- **Validation**: Zod (env vars via `src/config/env.ts`, route inputs via `@hono/zod-validator`)
- **Tests**: Vitest
- **Linting**: ESLint with `typescript-eslint` strict + stylistic type-checked
- **Formatting**: Prettier

## Coding standards

See `.claude/coding-standards.md` for the full coding standards (early return, no `else`, naming, strict types, etc.).

## Key conventions

### TypeScript
- `moduleResolution: NodeNext` — always use `.js` extensions in imports (e.g. `./foo.js` resolves to `./foo.ts`)
- Strict mode enabled: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.
- Prefer `interface` over `type` (`@typescript-eslint/consistent-type-definitions`)
- Use `import type` for type-only imports (`@typescript-eslint/consistent-type-imports`)

### Project structure
- Code is organized by feature: `src/features/<feature>/`
- Each endpoint lives in its own file under `src/features/<feature>/endpoints/`. **Contract schemas live in `@keimelion/sdk`**: endpoint files import their request schema from `@keimelion/sdk/schemas` and services use the SDK `XParsed` types. Only API-internal, non-contract validation (path params, multipart transport coercion) may stay local in the endpoint file
- Types used only within one endpoint are defined inline; types shared across multiple files within a feature go in the mapper or service file, not in a standalone `types.ts`
- Features that cover multiple resources are subdivided: `src/features/admin/users/`, `src/features/admin/ban/`… with a top-level `admin.routes.ts` that composes the sub-routers
- Shared infrastructure (types, utils, middlewares, schemas) lives in `src/shared/`
- Shared contract primitives (pagination, password, username, slug, url, currency, sort) and contract enums come from `@keimelion/sdk`; `src/shared/schemas/` and `src/shared/enums/` only keep API-internal ones (`uuidParamSchema`, `HonoContextKey`, `NodeEnvs`)
- Generic DB queries reused across multiple features go in `src/db/entities/<entity>/` (e.g. `src/db/entities/users/users.repository.ts`); feature-specific queries stay in the feature repository
- Repository functions accept generic shared types (e.g. `PaginationQueryParsed` from the SDK), not feature-specific input types
- Tests are colocated with their feature: `src/features/<feature>/<feature>.test.ts`

### Testing
- Framework: Vitest
- Global mocks for `db/client.js` and `config/env.js` are centralized in `src/test/setup.ts` (loaded via `vitest.config.ts` `setupFiles`) — do not repeat them in individual test files
- `@typescript-eslint/unbound-method` is disabled for `*.test.ts` files (false positive with `vi.mocked`)
- Cast `res.json()` responses with `as MyType` — `Response.json()` does not accept a generic

### Error handling
- Specific error messages belong in `errorMap` under a dedicated `ErrorCode` entry (see `src/shared/utils/response.ts`), not inline via `serviceError(code, { message })`. The inline form keeps the generic message at the response top-level `message` and buries the custom one under `metadata.message` — leaky, and forces every caller to repeat the string. A dedicated code puts the specific message at `message` and lets clients branch on the specific `code`.
- `ErrorCode` and the refine / error message constants live in `@keimelion/sdk` (`@keimelion/sdk/enums`, `@keimelion/sdk/schemas`); `errorMap` (code → HTTP status + message) stays in the API (`src/shared/utils/response.ts`) and imports them. A new error code or message is added to the SDK first.

### API contract — `@keimelion/sdk`
- `@keimelion/sdk` is the **single source of truth for the API contract** (request/response schemas, enums, `ErrorCode`, messages). Rules and workflow: `.claude/coding-standards.md` → "API contract — `@keimelion/sdk`"
- **Any API change to a request/response shape requires a paired SDK PR, released first**; the API PR then bumps the `@keimelion/sdk` dependency
- Changing an SDK enum requires a paired DB migration in the API (the `pgEnum`s derive from the SDK value arrays)
- Mappers are typed on SDK output types; auth tests assert each happy-path body with `schema.parse(...)`
- Local dev against an unreleased SDK: `npx yalc link @keimelion/sdk` (never `yalc add`); `.yalc/` and `yalc.lock` are gitignored and rejected by the `pre-commit` hook

## Data model rules

### RGPD exportability
Every new DB table linked to `users` — directly (FK `user_id`) **or transitively** (e.g. `list_items` → `lists` → `users`) — must be wired into the RGPD export endpoint `GET /users/me/export` in the **same ticket** that introduces the table. This is a legal obligation (RGPD art. 20 — right to portability), not an optional follow-up.

The ticket that adds such a table must:
1. Include in its AC the addition of the new section in the export (JSON + CSV)
2. Add corresponding tests in `src/features/users/users.test.ts`
3. Confirm no sensitive field (internal tokens, secrets, hashes) leaks in the export mapper

Once the ZIP-of-CSVs streaming architecture (KEI-37) lands, adding an entity = one new CSV file in the ZIP + one new key in the JSON payload.

## Commands

```bash
npm run dev          # Start dev server
npm test             # Run tests (add -- --run for single pass)
npm run lint         # ESLint
npm run format       # Prettier
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
```

## Environment

Validated at startup via Zod in `src/config/env.ts`. Will `process.exit(1)` if invalid.
Required variable: `DATABASE_URL`. All others have defaults.
