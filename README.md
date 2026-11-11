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

npm run mail:dev      # Preview every email (FR + EN, HTML + text) at http://localhost:3100, sends nothing
npm run mail:test -- <template> <locale>  # Send one email with sample data to MAIL_TEST_TO (see Emails)
```

---

## Emails

Every transactional email is built on one shared shell, `src/shared/mail/shell/`, which implements
the KEI-164 design. An email only supplies its content; the shell does the layout, styles, dark mode,
plain-text version and footer. Sending always goes through `sendMail` (`src/shared/mail/mail.sender.ts`).

### Preview while developing

```bash
npm run dev        # serves the email images at http://localhost:3000/assets/mail/*
npm run mail:dev   # http://localhost:3100: every email, FR + EN, HTML + text
```

`mail:dev` uses sample data, sends nothing, and reloads the page on every save. Without `npm run dev`
running, the preview works but shows no images.

### Send yourself a real test email

```bash
npm run mail:test -- waitlist-confirmation fr
```

The command sends through the real provider, so the local `.env` needs:

- `EMAIL_API_KEY` and `EMAIL_FROM`
- `MAIL_TEST_TO`, the address that receives the email
- `LANDING_URL`, a non-local URL such as `https://keimelion.zalbani.dev`

Mail clients can't load images from `localhost`. To see images before they are deployed, point
`APP_URL` at a pushed commit for that one command:
`APP_URL=https://raw.githubusercontent.com/Keimelion/Keimelion-API/<sha>/`.

### Add a new email

1. Create `src/features/<feature>/emails/<name>.email.ts` and return `renderEmail({...})` with the
   content: locale, subject, preheader, `bannerTheme`, kicker, title, paragraphs, button, optional
   info box and closing note, footer links. Keep the FR and EN copy in that file.
   `src/features/waitlist/emails/waitlist-confirmation.email.ts` is the model to follow.
2. Register it in `src/dev/mail/email-catalog.ts` with sample data, so `mail:dev` and `mail:test`
   both cover it.
3. Send it with `sendMail` from the service, and never make the HTTP response wait for the provider.

The shell modules, in order: logo, illustrated banner, handwritten kicker, title, body, button,
info box, fallback link, ribbon divider, closing note, signature, footer.

The banner themes are `waitlist`, `reservation`, `account` and `launch`
(`src/shared/mail/shell/email-shell.theme.ts`).

### Email images

The email images are PNG files in `assets/mail/`, kept apart from the user uploads. The API serves
them at `APP_URL/assets/mail/*` in every environment.

To change an image or add a banner theme:

1. Edit `src/dev/mail/render-mail-assets.ts`. Colours, sizes and file names come from
   `src/shared/mail/shell/email-shell.theme.ts`, shared with the email HTML.
2. Run `npm run mail:assets`.
3. Commit the PNG files it generates.

Emails already sent keep loading these URLs, so a redesign should add new file names instead of
overwriting the existing files.

---

## Background jobs

The API bootstraps a small in-process scheduler (`src/cron/`) that runs lightweight maintenance jobs via `setInterval` from the main server process. Each job's cadence is driven by its own env var so operators can tune it per environment.

| Job | Env flag(s) | Default cadence | Purpose |
|---|---|---|---|
| Expired JWT cleanup | `JWT_CLEANUP_INTERVAL_MS` | 1 h | Deletes expired access-token rows |
| Expired refresh token cleanup | `REFRESH_TOKEN_CLEANUP_INTERVAL_MS` | 1 h | Deletes expired refresh-token rows |
| Hard-delete inactive users | `USER_HARD_DELETE_INTERVAL_MS`, `USER_HARD_DELETE_GRACE_DAYS` | 1 h / 30 d | Purges soft-deleted and 24-month-inactive users |
| Waitlist entries purge | `WAITLIST_PURGE_INTERVAL_MS`, `WAITLIST_CONFIRMATION_VALIDITY_DAYS` | 1 h / 7 d | Deletes unconfirmed signups once their link lapses, and entries 12 months after the launch email |
| **FX rates refresh** | `FX_REFRESH_ENABLED`, `FX_REFRESH_INTERVAL_MS`, `FX_PROVIDER_URL` | 24 h | Refreshes `currencies.usd_rate` from an FX provider |

### FX rates refresh

The job keeps `currencies.usd_rate` + `currencies.usd_rate_as_of` current for every supported ISO 4217 code except USD (anchor row, always 1.0).

**Provider.** [ECB daily reference rates](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml) — free, no API key, published every working day shortly after 16:00 CET. The feed is base-EUR, so each incoming rate is pivoted to base USD: `usd_rate_X = ecb_rate_X / ecb_rate_USD` (and `usd_rate_EUR = 1 / ecb_rate_USD`). Override via `FX_PROVIDER_URL` only if you need a mirror.

**Trigger.** Two mutually-exclusive modes:

- **In-process scheduler.** Set `FX_REFRESH_ENABLED=true` and the server starts an interval-based scheduler (`FX_REFRESH_INTERVAL_MS`, default 24 h). Convenient for single-instance deployments. Not recommended with more than one API replica — every replica would hit the provider.
- **External scheduler (recommended for production).** Keep `FX_REFRESH_ENABLED=false` and drive a one-shot run from your platform scheduler (host `cron`, Docker Compose profile, Kubernetes CronJob, GitHub Actions, etc.):

  ```bash
  npm run fx:refresh
  ```

  The CLI exits `0` on success and `1` on failure.

**Guarantees.**

- **Graceful failure.** On provider HTTP error, network error, unparseable payload, or a missing USD rate, the job logs an error and skips the update — previous `usd_rate` / `usd_rate_as_of` values stay in place. No partial write.
- **Transactional update.** Every per-row `UPDATE` runs inside a single `db.transaction`; the transaction only opens after the full payload has been fetched and parsed, so a mid-batch failure rolls back the whole run.
- **Idempotent.** Re-running the job within the same day overwrites each row with the same values (modulo intraday provider revisions). Safe to re-trigger from cron, from the CLI, or from a manual invocation.

**Observability.** On success the job logs `FX refresh: rates updated` with `{ updatedCount, asOf, provider }`. On failure it logs an error with the HTTP status / parsed payload hint. The shared cron wrapper additionally emits a generic completion line per tick.

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
