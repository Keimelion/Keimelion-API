# Coding Standards — Keimelion API

These standards apply to all TypeScript source code. The Dev agent follows them when implementing; the Lead Dev agent enforces them during code review.

---

## Strict inputs and outputs

### Explicit return types on every function

All functions — exported or private — must declare their return type explicitly. Never rely on inference for function signatures.

```typescript
// ❌
async function getUser(id: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) })
  return { data: user, httpStatus: HttpStatus.OK }
}

// ✅
async function getUser(id: string): Promise<GetUserResult> {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) })
  return { data: user, httpStatus: HttpStatus.OK }
}
```

### Avoid optional properties — prefer explicit types

`field?: string` means the field may be completely absent from the object. This is ambiguous: does it mean "not yet set", "not applicable", or "forgotten"? Be explicit instead.

- Use **required fields** on domain types — if a value must exist after creation, it is required
- Use **separate input types** for creation/update where some fields are genuinely optional
- Use **`T | null`** (not `T | undefined`) when a value is intentionally absent — `null` is deliberate, `undefined` is accidental

```typescript
// ❌ — unclear which fields are truly optional vs just not always set
interface Item {
  id: string
  name?: string
  reservedBy?: string
  deletedAt?: Date
}

// ✅ — domain type is fully required; inputs are separate; nullable fields are explicit
interface Item {
  id: string
  name: string
  reservedBy: string | null   // null = not reserved, intentional absence
  deletedAt: Date | null      // null = not deleted
}

interface CreateItemInput {
  name: string                // required to create
  listId: string
}

interface UpdateItemInput {
  name?: string               // optional on update — field may or may not be changed
}
```

### Validate all external inputs with Zod at the route boundary

Every route that receives user input (body, params, query) must validate it with a Zod schema via a Hono validator before it reaches the service. The service receives already-typed, already-validated data — it never calls `.parse()` itself.

```typescript
// ❌ — service receives unvalidated input
itemRouter.post('/', async (c) => {
  const body = await c.req.json()
  const result = await createItem(body)
  return c.json(result.data, result.httpStatus)
})

// ✅ — validation at the route boundary, service receives clean types
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const createItemSchema = z.object({
  name: z.string().min(1).max(MAX_ITEM_NAME_LENGTH),
  listId: z.string().uuid(),
})

itemRouter.post('/', zValidator('json', createItemSchema), async (c) => {
  const input = c.req.valid('json')   // fully typed, validated
  const result = await createItem(input)
  return c.json(result.data, result.httpStatus)
})
```

### `null` over `undefined` for intentional absence

`undefined` means a value was never set. `null` means it was explicitly set to nothing. In domain types, use `null` for intentional absence — it is deliberate and serializes correctly in JSON (`undefined` disappears).

```typescript
// ❌
interface List {
  deletedAt: Date | undefined
}

// ✅
interface List {
  deletedAt: Date | null
}
```

---

## Early return — no `else`

Fail fast. Handle error cases and guard clauses first, then write the happy path without nesting. **`else` is never allowed** — if the `if` block returns, the `else` is redundant; if it doesn't, extract a function.

```typescript
// ❌
async function getList(id: string) {
  const list = await db.query.lists.findFirst({ where: eq(lists.id, id) })
  if (list) {
    if (!list.deletedAt) {
      return { data: list, httpStatus: HttpStatus.OK }
    } else {
      return { data: sendError(ErrorCode.NOT_FOUND), httpStatus: HttpStatus.NOT_FOUND }
    }
  } else {
    return { data: sendError(ErrorCode.NOT_FOUND), httpStatus: HttpStatus.NOT_FOUND }
  }
}

// ✅
async function getList(id: string) {
  const list = await db.query.lists.findFirst({ where: eq(lists.id, id) })
  if (!list || list.deletedAt) {
    return { data: sendError(ErrorCode.NOT_FOUND), httpStatus: HttpStatus.NOT_FOUND }
  }
  return { data: list, httpStatus: HttpStatus.OK }
}
```

---

## No abbreviations

Use full, descriptive names. Abbreviations save keystrokes but cost clarity.

| ❌ Avoid | ✅ Use |
|---|---|
| `req`, `res` | `request`, `response` |
| `err` | `error` |
| `usr`, `u` | `user` |
| `db` (local var) | `database` or keep `db` only for the imported client |
| `msg` | `message` |
| `val` | `value` |
| `ctx` | `context` |
| `cb` | `callback` |
| `idx`, `i` | use descriptive loop variable or `.map()` / `.filter()` |

Exception: well-known, unambiguous domain acronyms (`id`, `url`, `uuid`, `http`) are acceptable.

---

## No comments — self-explaining names

A comment is a sign that the code needs a better name. Rename the function or variable instead of annotating it.

```typescript
// ❌
// Check if the list belongs to the user before updating
if (list.userId !== userId) { ... }

// ✅
function isListOwnedByUser(list: List, userId: string): boolean {
  return list.userId === userId
}
if (!isListOwnedByUser(list, userId)) { ... }
```

The only acceptable comments are:
- Workarounds for external library bugs (with a link to the issue)
- Non-obvious legal or compliance requirements

---

## Minimal parameters

- **Max 3 parameters** for a function. Beyond that, group related params into an object.
- Boolean parameters are a smell — they usually mean the function does two things. Split it.

```typescript
// ❌
function createItem(name: string, listId: string, userId: string, isPublic: boolean, quantity: number) { ... }

// ✅
interface CreateItemInput {
  name: string
  listId: string
  userId: string
  isPublic: boolean
  quantity: number
}
function createItem(input: CreateItemInput) { ... }
```

---

## Maximum function length: 25 lines

A function body should not exceed 25 lines (excluding the signature and closing brace). If it does, extract sub-functions with descriptive names.

This limit applies to the function body, not counting blank lines or the function signature.

---

## Single responsibility

Each function does exactly one thing. The name should describe it completely without "and" or "or".

```typescript
// ❌ — does two things
async function validateAndCreateUser(email: string, password: string) { ... }

// ✅ — each function has one job
async function validateUserInput(email: string, password: string) { ... }
async function createUser(email: string, hashedPassword: string) { ... }
```

---

## `switch/case` over `if/else if` chains

When branching on a single value with 3 or more cases, use `switch/case`. It is more readable and exhaustiveness-checkable by TypeScript.

```typescript
// ❌
function getErrorMessage(code: ErrorCode) {
  if (code === ErrorCode.NOT_FOUND) {
    return 'Resource not found'
  } else if (code === ErrorCode.UNAUTHORIZED) {
    return 'Unauthorized'
  } else if (code === ErrorCode.FORBIDDEN) {
    return 'Forbidden'
  } else {
    return 'Internal server error'
  }
}

// ✅
function getErrorMessage(code: ErrorCode): string {
  switch (code) {
    case ErrorCode.NOT_FOUND:
      return 'Resource not found'
    case ErrorCode.UNAUTHORIZED:
      return 'Unauthorized'
    case ErrorCode.FORBIDDEN:
      return 'Forbidden'
    default:
      return 'Internal server error'
  }
}
```

Combined with TypeScript's exhaustiveness checking: if `default` should never be reached, use `satisfies never` to get a compile error when a case is missing.

---

## Shared enums — no magic strings or numbers

Never use raw string or number literals for values that carry semantic meaning. Define a `const` array with `as const` and derive the type from it.

```typescript
// ❌
if (item.status === 'reserved') { ... }

// ✅ — define once, reuse everywhere
export const ITEM_STATUS_VALUES = ['available', 'reserved', 'purchased'] as const
export type ItemStatus = (typeof ITEM_STATUS_VALUES)[number]

if (item.status === 'reserved') { ... }
```

Enums that are specific to a single file stay local; enums shared across multiple files (e.g. used by both the entity and the DB schema) go in the entity's `enums/` folder — see **Project structure — entity folders** below.

---

## No magic numbers or strings — local constants

Any literal that is not immediately obvious from context must be named. Define it as a `const` at the top of the file (or in `src/types/` if reused across files).

```typescript
// ❌
if (name.length > 50) { ... }
setTimeout(callback, 3000)
if (retries >= 3) { ... }

// ✅
const MAX_NAME_LENGTH = 50
const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 3

if (name.length > MAX_NAME_LENGTH) { ... }
setTimeout(callback, RETRY_DELAY_MS)
if (retries >= MAX_RETRIES) { ... }
```

---

## `const` over `let`, never `var`

Default to `const`. Use `let` only when the variable genuinely needs to be reassigned. If you find yourself reaching for `let`, first ask whether a `.map()` / `.filter()` / ternary would remove the need for mutation.

`var` is never acceptable.

---

## Array methods over `for` loops

Prefer declarative array methods over imperative loops. They express intent, not mechanics.

```typescript
// ❌
const names: string[] = []
for (let i = 0; i < users.length; i++) {
  if (users[i].isActive) {
    names.push(users[i].name)
  }
}

// ✅
const names = users.filter((user) => user.isActive).map((user) => user.name)
```

Use `.map()`, `.filter()`, `.find()`, `.some()`, `.every()`, `.reduce()`. A `for` loop is acceptable only when you need `break` / `continue` semantics that can't be expressed otherwise.

---

## No nested ternaries

A single ternary for a simple inline condition is fine. Two levels of nesting: extract a function.

```typescript
// ❌
const label = isOwner ? 'owner' : isAdmin ? 'admin' : 'member'

// ✅
function resolveUserLabel(isOwner: boolean, isAdmin: boolean): string {
  if (isOwner) return 'owner'
  if (isAdmin) return 'admin'
  return 'member'
}
```

---

## `async/await` only — no `.then()` / `.catch()`

All async code uses `async/await`. Never chain `.then()` or `.catch()` — it mixes paradigms and makes control flow harder to follow.

```typescript
// ❌
function getUser(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
    .then((user) => ({ data: user, httpStatus: HttpStatus.OK }))
    .catch((err) => ({ data: sendError(ErrorCode.INTERNAL), httpStatus: HttpStatus.INTERNAL_SERVER_ERROR }))
}

// ✅
async function getUser(id: string) {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) })
    return { data: user, httpStatus: HttpStatus.OK }
  } catch {
    return { data: sendError(ErrorCode.INTERNAL), httpStatus: HttpStatus.INTERNAL_SERVER_ERROR }
  }
}
```

---

## Named exports only — no default exports

Always use named exports. Default exports make refactoring harder (the import name is not enforced) and reduce discoverability.

```typescript
// ❌
export default function getUserById() { ... }

// ✅
export function getUserById() { ... }
```

---

## No `any` in template literals — explicit types only

`@typescript-eslint/restrict-template-expressions` forbids values typed as `any`, `null`, `undefined`, or object types inside template literals. Only `string`, `number`, `boolean`, and `bigint` are allowed directly.

Common triggers:
- Optional env vars typed `string | undefined`
- Properties of objects with `any` index signatures (e.g. untyped external payloads)
- Values that haven't been narrowed yet

Fix by narrowing, converting, or avoiding template literals where possible:

```typescript
// ❌ — string | undefined, any, or object
const msg = `Status: ${maybeNull}`
const url = `${env.APP_URL}/path`  // if APP_URL were string | undefined

// ✅ — narrow or convert before interpolating
const msg = `Status: ${maybeNull ?? 'unknown'}`
const msg = `Code: ${String(value)}`

// ✅ — for URLs, prefer the URL constructor (APP_URL is never in the template)
const verifyUrl = new URL(`/auth/verify-email?token=${token}`, env.APP_URL).href
```

---

## `??` over `||` for nullish coalescing

Use `??` when you want to fall back only on `null` or `undefined`. `||` also coerces `0`, `""`, and `false` — which is almost never what you want in business logic.

```typescript
// ❌ — falls back when quantity is 0
const quantity = item.quantity || 1

// ✅ — falls back only when quantity is null/undefined
const quantity = item.quantity ?? 1
```

---

## Natural reading order

Functions in a file should read top-to-bottom in the order a reader would want to understand them:

1. **Exported functions first** — the public API of the module, what callers care about
2. **Private helpers after** — implementation details, in the order they are called

A reader opening the file sees the intent at the top and drills into details below. Never bury the main function at the bottom after all its helpers.

```typescript
// ✅ — service file reading order
export async function createList(input: CreateListInput) {
  validateListInput(input)
  const slug = buildSlug(input.name)
  return persistList({ ...input, slug })
}

function validateListInput(input: CreateListInput) { ... }
function buildSlug(name: string): string { ... }
async function persistList(data: ListRow) { ... }
```

---

## Naming conventions

- **Functions**: `verb + noun` in camelCase — `getUserById`, `createWishlist`, `deleteItem`
- **Booleans**: `is` / `has` / `can` prefix — `isDeleted`, `hasPermission`, `canEdit`
- **Interfaces**: PascalCase noun — `UserService`, `CreateListInput`, `ListResult`
- **Constants**: SCREAMING_SNAKE_CASE for true constants — `MAX_ITEMS_PER_LIST`
- No single-letter variables except in well-understood math contexts

---

## Project structure — feature folders

Code is organized by feature under `src/features/<feature>/`:

```
src/features/users/
  users.enums.ts       # const arrays + derived types (AuthProvider, PlatformRole…)
  users.types.ts       # TypeScript interfaces: inputs, results, public types
  users.schemas.ts     # Zod schemas for route validation
  users.mappers.ts     # Transformation functions (DB row → public type)
  users.repository.ts  # All DB access for this feature
  users.service.ts     # Business logic
  users.routes.ts      # Route definitions
  users.test.ts        # Tests colocated with the feature
```

Shared infrastructure (types, utils, middlewares used across features) lives in `src/shared/`:

```
src/shared/
  types/
    api.ts
    app.ts
    enums/
      error-code.ts
      http.ts
  utils/
    hash.ts  logger.ts  rate-limiter.ts  response.ts  validation.ts
  middlewares/
    auth.ts  logger.ts  rate-limit.ts  request-id.ts
```

Rules:

- **TypeScript is the source of truth** — define enums in the feature (`const ... as const`), then derive the DB `pgEnum` from them; the DB schema imports from features, never the reverse
- Schemas, types, and mappers for a resource live with the feature, never in `src/shared/`

```typescript
// ✅ — feature defines the enum
// src/features/users/users.enums.ts
export const PLATFORM_ROLE_VALUES = ['user', 'moderator', 'admin'] as const
export type PlatformRole = (typeof PLATFORM_ROLE_VALUES)[number]

// ✅ — DB schema derives from it
// src/db/schema/users.ts
import { PLATFORM_ROLE_VALUES } from '../../features/users/users.enums.js'
export const platformRoleEnum = pgEnum('platform_role', PLATFORM_ROLE_VALUES)
```

---

## Repository pattern — all DB calls in repositories

All database access goes through `src/features/<feature>/<feature>.repository.ts`. Services never call the ORM directly.

- One repository file per domain entity
- Repositories may import from entities (types, enums) — entities never import from repositories
- Implementation details that belong to persistence (e.g. password hashing before insert) live in the repository, not in the calling service

```typescript
// ❌ — service knows about hashing
export async function registerUser(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password)
  await insertUser({ ...input, passwordHash })
}

// ✅ — hashing is an insert detail
// repository
export async function insertUser(input: RegisterInput): Promise<User | undefined> {
  const passwordHash = await hashPassword(input.password)
  // ...
}
// service
export async function registerUser(input: RegisterInput) {
  const user = await insertUser(input)
}
```

---

## Routes must stay clean

Route files (`src/features/<feature>/<feature>.routes.ts`) contain only route definitions, validators, and service calls. Any logic or configuration is extracted:

- Rate limiter factory → `src/shared/utils/rate-limiter.ts`
- Validation error handler → `src/shared/utils/validation.ts`
- Any business logic → a service function

```typescript
// ❌ — config and duplication in the route file
const REGISTER_RATE_LIMIT = 10
const rateLimiter = rateLimiter({ limit: REGISTER_RATE_LIMIT, ... })

// ✅ — route file stays declarative
import { createRateLimiter } from '../../shared/utils/rate-limiter.js'
router.post('/register', createRateLimiter(10), zValidator(...), async (c) => { ... })
```

---

## Specific error codes — no generic fallbacks

Each distinct failure mode has its own error code. `INTERNAL_ERROR` and `NOT_FOUND` are only acceptable when the situation is genuinely generic.

Add a specific code when:
- The client needs to distinguish this error from a similar one
- The generic message would be misleading or uninformative

```typescript
// ❌
return { data: sendError(ErrorCode.INTERNAL_ERROR), httpStatus: HttpStatus.INTERNAL_SERVER_ERROR }

// ✅
return { data: sendError(ErrorCode.USER_CREATION_FAILED), httpStatus: HttpStatus.INTERNAL_SERVER_ERROR }
```

---

## Trust the validation layer

Services receive already-validated, already-typed data from the route layer. Do not re-check constraints that Zod has already enforced.

- If Zod guarantees `password` is a non-empty string, do not handle an empty/null case in the service
- If Zod guarantees `email` is lowercased (via `.transform()`), do not lowercase it again in the service

---

## Normalise inputs at the Zod boundary

Data normalisation (lowercasing emails, trimming whitespace) belongs in the Zod schema via `.transform()` or `.trim()`, not in service functions.

```typescript
// ❌ — normalisation scattered in the service
const email = input.email.toLowerCase().trim()

// ✅ — normalised once at the boundary
const loginSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  username: z.string().trim().regex(USERNAME_REGEX).nullable().optional(),
})
```

---

## Generic result types — avoid repeated interfaces

Use `ServiceResult<T>` instead of creating a named interface for every function's return shape. Only name a result type when the shape is unique enough to be meaningful on its own.

```typescript
// ❌ — six interfaces, all structurally identical
interface RegisterResult { data: { user: SafeUser } | Response; httpStatus: number }
interface GetProfileResult { data: { user: SafeUser } | Response; httpStatus: number }
// ...

// ✅ — one generic, used inline
interface ServiceResult<T> { data: T | Response; httpStatus: number }

async function registerUser(input: RegisterInput): Promise<ServiceResult<{ user: SafeUser }>>
async function getProfile(userId: string): Promise<ServiceResult<{ user: SafeUser }>>
```

---

## Avoid overkill interfaces

Do not create an interface for a shape used in exactly one place. Inline the type or pass values directly.

```typescript
// ❌ — interface for a 2-field object used once
interface InsertUserParams { input: RegisterInput; emailVerifyToken: string }
async function insertUser(params: InsertUserParams) { ... }

// ✅ — just use the parameters directly
async function insertUser(input: RegisterInput, emailVerifyToken: string) { ... }
```

---

## Don't expose backend-only fields as API inputs

If the backend always sets a field to a fixed value regardless of what the client sends, remove it from the input schema entirely. The client should not need to know about it.

```typescript
// ❌ — isCgvAccepted is always true server-side; no need to accept it from the client
const registerSchema = z.object({
  email: z.string().email(),
  isCgvAccepted: z.literal(true),
})

// ✅ — set it unconditionally in the repository
await db.insert(users).values({ ...input, isCgvAccepted: true, cgvAcceptedAt: new Date() })
```

---

## Private helpers — ordering within the private section

Within the private section of a file (after all exported functions), order helpers in the order they are first called — top to bottom mirrors the call flow.

```typescript
// ✅
export async function registerUser(input) {
  if (await isEmailAlreadyTaken(input.email)) { ... }  // called first
  sendVerificationEmail(input.email, token)             // called second
}

// private section — same order as calls above
function sendVerificationEmail(...) { ... }  // ← first
async function isEmailAlreadyTaken(...) { ... }  // ← second
```
