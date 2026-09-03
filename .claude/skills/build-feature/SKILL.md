---
name: build-feature
description: Orchestrates the Dev → Lead Dev → DevOps → Tester pipeline for a Notion ticket. A triage step routes low-risk tickets through a slim Dev → Tester pipeline. Reviewers fix issues directly — no feedback loops back to Dev.
argument-hint: <Notion ticket URL or ID>
---

# Workflow: Build Feature

**Backlog kanban**: `66c4450ed2d04ad68c1b06e522169e6c`

Implement and validate the ticket: **$ARGUMENTS**

**Language**: all output must be in English — code, commit messages, PR titles and descriptions, Notion updates, GitHub comments.

**Valid Notion statuses** (exact values, case-sensitive):
`Todo` | `In Progress` | `In Review` | `Done` | `Validated`

**Status flow**: `Todo` → `In Progress` → `In Review` → `Validated`

All review stages (Lead Dev, DevOps, Tester) leave the ticket at `In Review` until the Tester validates. Only the Tester moves it to `Validated`. Reviewers fix issues directly on the branch — no feedback loops back to Dev.

## Pipeline lanes

Two lanes exist. The lane is decided in Step 0.5 and cannot be changed mid-run.

- **FULL** (default): Dev → Lead Dev → DevOps → Tester
- **SLIM**: Dev → Tester (skips Lead Dev and DevOps)

---

## Step 0 — Context fetch and dependency check (YOU do this, before delegating to any agent)

Fetch the ticket **$ARGUMENTS** yourself using your Notion MCP tools and store its full content (description, acceptance criteria, technical notes, status, all comments).

**Dependency check**: if the ticket has entries in "Blocked By", fetch each of those tickets and check their status. If any dependency is neither `Done` nor `Validated`:
- Leave a comment listing which dependencies are not yet done/validated and their current status
- **Stop the pipeline** and inform the user — do not proceed with implementation

---

## Step 0.5 — Triage: choose the pipeline lane (YOU do this)

Based on the ticket content (description, acceptance criteria, technical notes) and a quick read of the files it is likely to touch, classify the ticket.

**Route to SLIM only if ALL of the following are true:**
- No DB schema changes (no create/modify under `src/db/entities/`, no new migration expected)
- No changes to authentication, authorization, or session handling (`src/features/auth/`, `src/shared/middlewares/auth.ts`, `src/shared/middlewares/require-admin.ts`, `jwt.service.ts`)
- No new HTTP endpoint added — only behaviour changes to existing endpoints, refactors, or bug fixes
- No handling of PII, tokens, secrets, or RGPD-relevant data
- No changes to rate limiters, CORS, security headers, or `docker-compose.yml`
- No cron / background job added or modified
- Expected diff is small (roughly < 100 lines of production code, tests excluded)

**Otherwise route to FULL.** When in doubt, choose FULL — the slim lane is an optimisation, not a shortcut.

Record the decision:
- Post a Notion comment on the ticket: `Pipeline lane: SLIM` or `Pipeline lane: FULL` with a one-line justification (which criterion pushed it to FULL, or a confirmation of all slim criteria).
- Store the lane — it is referenced in Steps 2 and 3.

---

## Step 1 — Dev: Implementation

Delegate to the Dev agent. Pass:
- The full ticket content (from Step 0)

Dev agent tasks:
- **Sync `dev` first** — run `git fetch origin dev` then `git checkout dev && git merge --ff-only origin/dev`. If the fast-forward fails (local `dev` has diverged), stop and report — do NOT force-update or rebase without explicit user approval.
- Create a branch following the naming convention, from the up-to-date `dev`
- Read existing files to understand patterns before writing any code
- Implement in order: DB schema → service → route → tests
- If DB schema was created or modified: run `npm run db:generate -- --name=<slug>` and confirm a `.sql` file was produced in `src/db/migrations/`
- Run `npm test -- --run`, `npx tsc --noEmit`, `npx eslint src/` — all must be clean
- Commit and push the branch, then create a PR targeting `dev` with `gh pr create --base dev`
- Update ticket status → `In Review`, update the **"PR URL"** field, leave a comment with the PR URL and all files created/modified

**Capture** (concise — bullet points only): branch name, PR URL, files created/modified, migration generated (yes/no).

---

## Step 2 — Lead Dev: Code Review

**FULL lane only.** If the lane recorded in Step 0.5 is SLIM, skip this step and continue to Step 4.

Before delegating, YOU (the orchestrator) read all files listed in the Dev summary using your Read tool and include their full contents inline in the prompt. This avoids the Lead Dev agent re-reading them from scratch and reduces token consumption.

Delegate to the Lead Dev agent. Pass:
- Ticket acceptance criteria and technical notes if available (from Step 0)
- Dev summary from Step 1
- Full contents of every file created/modified (read by you in the step above)

Lead Dev agent tasks:
- Review the provided file contents against the project standards checklist (no need to re-read files)
- Run `npm test -- --run`, `npx tsc --noEmit`, `npx eslint src/`
- Produce a structured review report (✅ positives / ⚠️ suggestions / ❌ blockers)
- Update the Notion ticket with the report and one of two outcomes:

**If APPROVED** → leave status at `In Review`, leave a comment "Lead Dev approved — ready for DevOps review", continue to Step 3

**If CHANGES REQUIRED** → fix the blocking issues directly, re-run checks, commit and push (`git add <files> && git commit -m "fix: address lead dev review (KEI-X)" && git push`), leave status at `In Review`, leave a comment "Lead Dev approved (after fixes) — ready for DevOps review" listing what was changed, continue to Step 3

**Capture** (concise — bullet points only): verdict, files modified (if any), key issues found/fixed.

---

## Step 3 — DevOps: Security & Integrity Review

**FULL lane only.** If the lane recorded in Step 0.5 is SLIM, skip this step and continue to Step 4.

Delegate to the DevOps agent. Pass:
- Ticket acceptance criteria and technical notes if available (from Step 0)
- Dev summary from Step 1
- Lead Dev summary from Step 2

DevOps agent tasks:
- Review security, data integrity, and deployment readiness
- Run `npm test -- --run` and `npx tsc --noEmit`
- If a migration file was generated, read it and confirm it matches the schema changes
- Produce a structured DevOps review report
- Update the Notion ticket with one of two outcomes:

**If APPROVED** → leave status at `In Review`, leave a comment "DevOps approved — ready for testing", continue to Step 4

**If ISSUES FOUND** → fix the issues directly, re-run checks, commit and push (`git add <files> && git commit -m "fix: address devops review (KEI-X)" && git push`), leave status at `In Review`, leave a comment "DevOps approved (after fixes) — ready for testing" listing what was changed, continue to Step 4

**Capture** (concise — bullet points only): verdict, files modified (if any), key issues found/fixed.

---

## Step 4 — Tester: Final Validation

Delegate to the Tester agent. Pass:
- Ticket acceptance criteria (from Step 0)
- Dev summary from Step 1 (endpoints and files)
- The pipeline lane (SLIM or FULL) recorded in Step 0.5

Tester agent tasks:
- Run `npm test -- --run`
- Manually test each endpoint (happy path + error cases + edge cases)
- Check every acceptance criterion
- **If lane is SLIM**: also verify that the actual diff still matches the slim criteria (no DB schema, no auth, no new endpoint, no security-sensitive surface). If it does not, stop, leave a Notion comment `Slim lane misclassified — re-run with FULL lane` and do NOT validate.
- Produce a structured test report
- Update the Notion ticket with one of two outcomes:

**If VALIDATED** → update status to `Validated`

**If BUGS FOUND** → fix the bugs directly, run `npm test -- --run` again to confirm clean, commit and push (`git add <files> && git commit -m "fix: address tester bugs (KEI-X)" && git push`), status → `Validated`, leave a comment with the test report listing what was fixed

---

## Final Summary

Once the pipeline completes, present:
1. Notion ticket final status
2. Pipeline lane used (SLIM or FULL)
3. PR URL (ready to merge into `dev`)
4. Branch name and files created/modified
5. Commits added per stage (Dev, Lead Dev if FULL and fixes, DevOps if FULL and fixes, Tester if fixes)
6. Test results summary
