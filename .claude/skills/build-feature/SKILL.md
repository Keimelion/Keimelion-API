---
name: build-feature
description: Orchestrates the Dev → Lead Dev → DevOps → Tester pipeline for a Notion ticket. Reviewers fix issues directly — no feedback loops back to Dev.
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

---

## Step 0 — Context fetch and dependency check (YOU do this, before delegating to any agent)

Fetch the ticket **$ARGUMENTS** yourself using your Notion MCP tools and store its full content (description, acceptance criteria, technical notes, status, all comments).

**Dependency check**: if the ticket has entries in "Blocked By", fetch each of those tickets and check their status. If any dependency is neither `Done` nor `Validated`:
- Leave a comment listing which dependencies are not yet done/validated and their current status
- **Stop the pipeline** and inform the user — do not proceed with implementation

---

## Step 1 — Dev: Implementation

Delegate to the Dev agent. Pass:
- The full ticket content (from Step 0)

Dev agent tasks:
- Create a branch following the naming convention, from `dev`
- Read existing files to understand patterns before writing any code
- Implement in order: DB schema → service → route → tests
- If DB schema was created or modified: run `npm run db:generate -- --name=<slug>` and confirm a `.sql` file was produced in `src/db/migrations/`
- Run `npm test -- --run`, `npx tsc --noEmit`, `npx eslint src/` — all must be clean
- Commit and push the branch, then create a PR targeting `dev` with `gh pr create --base dev`
- Update ticket status → `In Review`, update the **"PR URL"** field, leave a comment with the PR URL and all files created/modified

**Capture** (concise — bullet points only): branch name, PR URL, files created/modified, migration generated (yes/no).

---

## Step 2 — Lead Dev: Code Review

Delegate to the Lead Dev agent. Pass:
- Ticket acceptance criteria and technical notes if available (from Step 0)
- Dev summary from Step 1

Lead Dev agent tasks:
- Review all modified files against the project standards checklist
- Run `npm test -- --run`, `npx tsc --noEmit`, `npx eslint src/`
- Produce a structured review report (✅ positives / ⚠️ suggestions / ❌ blockers)
- Update the Notion ticket with the report and one of two outcomes:

**If APPROVED** → leave status at `In Review`, leave a comment "Lead Dev approved — ready for DevOps review", continue to Step 3

**If CHANGES REQUIRED** → fix the blocking issues directly, re-run checks, commit and push (`git add <files> && git commit -m "fix: address lead dev review (KEI-X)" && git push`), leave status at `In Review`, leave a comment "Lead Dev approved (after fixes) — ready for DevOps review" listing what was changed, continue to Step 3

**Capture** (concise — bullet points only): verdict, files modified (if any), key issues found/fixed.

---

## Step 3 — DevOps: Security & Integrity Review

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

Tester agent tasks:
- Run `npm test -- --run`
- Manually test each endpoint (happy path + error cases + edge cases)
- Check every acceptance criterion
- Produce a structured test report
- Update the Notion ticket with one of two outcomes:

**If VALIDATED** → update status to `Validated`

**If BUGS FOUND** → fix the bugs directly, run `npm test -- --run` again to confirm clean, commit and push (`git add <files> && git commit -m "fix: address tester bugs (KEI-X)" && git push`), status → `Validated`, leave a comment with the test report listing what was fixed

---

## Final Summary

Once the pipeline completes, present:
1. Notion ticket final status
2. PR URL (ready to merge into `dev`)
3. Branch name and files created/modified
4. Commits added per stage (Dev, Lead Dev if fixes, DevOps if fixes, Tester if fixes)
5. Test results summary
