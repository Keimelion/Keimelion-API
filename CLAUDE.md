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
- Each endpoint lives in its own file under `src/features/<feature>/endpoints/` — Zod schema and input type defined inline in that file, not in a separate `schemas.ts`
- Types used only within one endpoint are defined inline; types shared across multiple files within a feature go in the mapper or service file, not in a standalone `types.ts`
- Features that cover multiple resources are subdivided: `src/features/admin/users/`, `src/features/admin/ban/`… with a top-level `admin.routes.ts` that composes the sub-routers
- Shared infrastructure (types, utils, middlewares, schemas) lives in `src/shared/`
- Reusable Zod schemas shared across features (e.g. pagination) go in `src/shared/schemas/`
- Generic DB queries reused across multiple features go in `src/db/entities/<entity>/` (e.g. `src/db/entities/users/users.repository.ts`); feature-specific queries stay in the feature repository
- Repository functions accept generic shared types (e.g. `PaginationInput`), not feature-specific input types
- Tests are colocated with their feature: `src/features/<feature>/<feature>.test.ts`

### Testing
- Framework: Vitest
- Global mocks for `db/client.js` and `config/env.js` are centralized in `src/test/setup.ts` (loaded via `vitest.config.ts` `setupFiles`) — do not repeat them in individual test files
- `@typescript-eslint/unbound-method` is disabled for `*.test.ts` files (false positive with `vi.mocked`)
- Cast `res.json()` responses with `as MyType` — `Response.json()` does not accept a generic

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
