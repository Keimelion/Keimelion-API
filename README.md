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
curl http://localhost:3000/health
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
├── config/              # Environment variable validation (Zod)
├── db/
│   ├── client.ts        # Drizzle connection
│   ├── entities/        # Table schemas + fixtures (one folder per entity)
│   ├── seed/            # Seed runner + dev reset script
│   └── migrations/      # Generated SQL migrations
├── features/            # Feature modules (routes, service, repository, tests)
│   ├── auth/
│   ├── health/
│   └── users/
└── shared/              # Cross-cutting infrastructure
    ├── enums/           # HTTP codes, error codes, roles
    ├── middlewares/     # Auth, logger, rate-limit, request-id
    ├── types/           # ApiError, AppVariables, ServiceResult<T>
    └── utils/           # Hash, logger, response helpers, validation
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

---

## Claude Code — agent workflow

Repo-tracked Claude Code configuration lives under `.claude/`. Feature tickets flow through a **single senior Dev agent** that owns the ticket end-to-end: implementation, architecture self-review, security audit, DB migration audit, curl smoke test, PR, and Notion status updates. There is no separate Lead Dev / DevOps / Tester agent.

| File | Purpose |
|---|---|
| `.claude/agents/dev.md` | The single dev agent — merged Dev + Lead Dev + DevOps + Tester responsibilities, with a self-review checklist |
| `.claude/agents/po.md` | Product Owner — grooms Notion tickets from specs |
| `.claude/agents/doc-writer.md` | Updates Notion spec pages after a feature is Validated |
| `.claude/skills/build-feature/` | `/build-feature <ticket>` — delegates to the Dev end-to-end |
| `.claude/skills/refine-ticket/` | `/refine-ticket <ticket>` — PO + Dev collaborative refinement |
| `.claude/skills/apply-pr-review/` | `/apply-pr-review` — Dev applies (or pushes back on) PR review comments |
| `.claude/skills/document-feature/` | `/document-feature` — sync Notion specs with the implementation |
| `.claude/coding-standards.md` | Single source of truth for style rules the Dev follows and enforces |

### Notion access — local REST wrapper

The Dev agent does **not** use the Notion MCP server. All Notion interactions go through `scripts/notion/notion.mjs`, a zero-dependency Node ESM wrapper around the Notion REST API — cheaper per call and lighter on tool-definition context:

```bash
node scripts/notion/notion.mjs get-page <page-id>
node scripts/notion/notion.mjs set-status <page-id> "In Progress"
node scripts/notion/notion.mjs set-property <page-id> "PR URL" "https://…"
node scripts/notion/notion.mjs add-comment <page-id> "…"
```

**Setup** (one time):
1. Create an internal Notion integration at https://www.notion.so/profile/integrations
2. Share every Notion database the agent reads or writes (backlog, features spec, MVP scope, DB schema, architecture, conventions) with the integration
3. Add `NOTION_TOKEN=secret_…` to `.env` — the wrapper auto-loads it from the CWD, no `export` needed

The PO agent keeps its Notion MCP tools (used rarely, benefits from MCP's ergonomic search + create). Only the Dev is on the wrapper.
