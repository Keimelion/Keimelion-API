# Keimelion API

**The backend API for [Keimelion](https://keimelion.com)** — collaborative wishlists.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-latest-C5F74F?logo=drizzle&logoColor=black)

---

## Getting started

> Prerequisites: **Node.js v20+** and **Docker Desktop**

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL
docker compose up -d

# Run migrations
npm run db:migrate

# (Optional) Seed with fixture users
npm run db:seed

# Start the server
npm run dev
```

The API is available at **http://localhost:3000**.

### Quick check

```bash
curl http://localhost:3000/v1/health
# { "status": "ok", "database": "ok", "version": "1.0.0", ... }
```

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js |
| Framework | [Hono](https://hono.dev) — lightweight, TypeScript-first |
| ORM | [Drizzle ORM](https://orm.drizzle.team) — typed SQL, no magic |
| Database | PostgreSQL 16 |
| Validation | [Zod](https://zod.dev) |
| Tests | Vitest |

---

## Project structure

```
src/
├── config/          # Environment variable validation (Zod)
├── db/
│   ├── client.ts    # Drizzle connection
│   ├── schema/      # Table definitions (one file per table)
│   ├── seed/        # Fixture data + dev scripts (one file per table)
│   │   ├── index.ts #   Run all seeds
│   │   └── reset.ts #   Drop + migrate + seed (dev only)
│   └── migrations/  # Generated SQL migrations
├── middlewares/     # Error handler, rate limiter, request ID
├── routes/
│   └── health/      # Route + tests colocated per resource
├── services/        # Business logic
└── types/           # ApiResponse<T>, ApiError, PaginatedResponse<T>
```

---

## Commands

```bash
npm run dev           # Development server (hot reload)
npm run build         # Compile TypeScript
npm run lint          # ESLint
npm run format        # Prettier

npm run db:generate   # Generate migrations from schema
npm run db:migrate    # Apply pending migrations
npm run db:seed       # Insert fixture data (truncates then re-inserts)
npm run db:reset      # Drop schema, re-migrate, re-seed (dev only)
npm run db:studio     # Open Drizzle Studio (GUI)

npm test              # Run Vitest tests
```

### Fixture users

`npm run db:seed` populates the `users` table with 6 realistic users:

| Email | Auth | Role | Notes |
|---|---|---|---|
| `alice.martin@gmail.com` | Google | user | Active |
| `thomas.bernard@outlook.com` | email | user | Active — password: `password` |
| `sophie.lefevre@gmail.com` | Google | user | Active |
| `admin@keimelion.com` | email | admin | Platform admin — password: `password` |
| `julien.moreau@yahoo.fr` | email | user | Soft-deleted (`deleted_at` set) |
| `marc.dupont@hotmail.com` | email | user | Banned (`banned_at` + `ban_reason` set) |

> **Warning**: `db:seed` deletes all existing rows in `users` before inserting. Development only.

---

## Commit convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/) enforced via `commitlint` + `husky`.

```
<type>(<scope>): <message>

feat(auth): add JWT authentication
fix(health): handle db timeout correctly
chore: update dependencies
```

| Type | Usage |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `test` | Adding or updating tests |
| `chore` | Maintenance, dependencies, config |
| `docs` | Documentation only |
| `perf` | Performance improvement |
| `ci` | CI/CD |
