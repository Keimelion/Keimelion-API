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

Never use raw string or number literals for values that carry semantic meaning. Define an `enum` or a `const` object and reuse it.

```typescript
// ❌
if (item.status === 'reserved') { ... }
if (list.visibility === 2) { ... }

// ✅ — define once, reuse everywhere
export enum ItemStatus {
  Available = 'available',
  Reserved = 'reserved',
  Purchased = 'purchased',
}

export enum ListVisibility {
  Private = 1,
  FriendsOnly = 2,
  Public = 3,
}

if (item.status === ItemStatus.Reserved) { ... }
if (list.visibility === ListVisibility.FriendsOnly) { ... }
```

Enums that are specific to a single file stay local; enums shared across multiple files go in `src/types/`.

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
