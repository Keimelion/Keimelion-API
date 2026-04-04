---
name: build-feature
description: Orchestrates the Dev → Lead Dev → DevOps → Tester pipeline for a Notion ticket. Handles feedback loops — if any reviewer raises issues, the Dev addresses them before the next review round.
argument-hint: <Notion ticket URL or ID>
---

# Workflow: Build Feature

**Backlog kanban**: `66c4450ed2d04ad68c1b06e522169e6c`

Implement and validate the ticket: **$ARGUMENTS**

**Status flow**: `Todo` → `In Progress` → `In Review` → `Ops Review` → `Done` → `Validated`

---

## Step 0 — Context fetch (YOU do this, before delegating to any agent)

Fetch the ticket **$ARGUMENTS** yourself using your Notion MCP tools and store its full content (description, acceptance criteria, technical notes, status, all comments).

You will pass this content inline to each agent — **no agent should call notion-fetch or notion-search to read the ticket**. Agents only call Notion MCP to write (update status, add comment).

---

## Step 1 — Dev: Implementation

Delegate to the Dev agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- **Instruction: do NOT call any Notion MCP tools to read the ticket — the full content is already provided above. Only use Notion MCP to update the ticket status and leave comments.**

Dev agent tasks:
- Create a branch following the naming convention, from `dev`
- Read existing files to understand patterns before writing any code
- Implement in order: DB schema → service → route → tests
- Run `npm test -- --run` and `npx tsc --noEmit` — both must be clean
- Update ticket status → `In Review`
- Leave a comment with the branch name and all files created/modified

**Capture the Dev's full output (branch name, files created/modified, implementation summary) to pass forward.**

---

## Step 2 — Lead Dev: Code Review

Delegate to the Lead Dev agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- **Dev implementation summary** (full output from Step 1: branch name, files modified, any notes)
- **Instruction: do NOT call any Notion MCP tools to read the ticket — all context is already provided above. Only use Notion MCP to update the ticket status and leave comments.**

Lead Dev agent tasks:
- Review all modified files against the project standards checklist
- Run `npm test -- --run`, `npx tsc --noEmit`, `npx eslint src/`
- Produce a structured review report (✅ positives / ⚠️ suggestions / ❌ blockers)
- Update the Notion ticket with the report and one of two outcomes:

**If APPROVED** → update status to `Ops Review`, continue to Step 3

**If CHANGES REQUIRED** → update status to `In Progress`, list blocking issues
  → Delegate to the Dev agent with the ticket content + the review report
  → Dev addresses every blocking issue, sets status back to `In Review`, updates the ticket comment
  → Return to Step 2 with updated Dev output (repeat until approved, max 3 rounds)

**Capture the Lead Dev's review report to pass forward.**

---

## Step 3 — DevOps: Security & Integrity Review

Delegate to the DevOps agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- **Dev implementation summary** (from Step 1)
- **Lead Dev review report** (from Step 2)
- **Instruction: do NOT call any Notion MCP tools to read the ticket — all context is already provided above. Only use Notion MCP to update the ticket status and leave comments.**

DevOps agent tasks:
- Review security, data integrity, and deployment readiness
- Run `npm test -- --run` and `npx tsc --noEmit`
- Produce a structured DevOps review report
- Update the Notion ticket with one of two outcomes:

**If APPROVED** → update status to `Done`, leave a comment with the report, continue to Step 4

**If ISSUES FOUND** → update status to `In Progress`, list each issue with file:line and fix
  → Delegate to the Dev agent with the ticket content + the DevOps report
  → Dev fixes each issue, sets status back to `In Review`, updates the ticket comment
  → Delegate to the Lead Dev with updated Dev output for a targeted review of modified files only
  → Lead Dev sets status back to `Ops Review` if approved
  → Return to Step 3 with updated reports (repeat until approved, max 3 rounds)

**Capture the DevOps review report to pass forward.**

---

## Step 4 — Tester: Final Validation

Delegate to the Tester agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- **Dev implementation summary** (from Step 1)
- **Lead Dev review report** (from Step 2)
- **DevOps review report** (from Step 3)
- **Instruction: do NOT call any Notion MCP tools to read the ticket — all context is already provided above. Only use Notion MCP to update the ticket status and leave comments.**

Tester agent tasks:
- Run `npm test -- --run`
- Manually test each endpoint (happy path + error cases + edge cases)
- Check every acceptance criterion
- Produce a structured test report
- Update the Notion ticket with one of two outcomes:

**If VALIDATED** → update status to `Validated`

**If BUGS FOUND** → update status to `In Progress`, document each bug with reproduction steps
  → Delegate to the Dev agent with the ticket content + the bug report
  → Dev fixes each bug, sets status back to `In Review`, updates the ticket comment
  → Delegate to the Lead Dev with updated Dev output for a targeted review of modified files only (not a full re-review)
  → Lead Dev sets status back to `Done` if approved (DevOps already signed off — no need to re-review)
  → Return to Step 4 (repeat until validated, max 3 rounds)

---

## Final Summary

Once the pipeline completes, present:
1. Notion ticket final status
2. Branch name and files created/modified
3. Number of review/fix rounds per stage (Lead Dev, DevOps, Tester)
4. Test results summary
