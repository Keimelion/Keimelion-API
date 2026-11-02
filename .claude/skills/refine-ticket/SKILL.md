---
name: refine-ticket
description: Collaborative refinement of an API ticket — the PO and the senior Dev discuss a Notion ticket together to clarify requirements, identify edge cases, agree on the technical approach, and update the ticket with a refined spec before implementation starts.
argument-hint: <Notion ticket URL or ID>
---

# Workflow: Refine Ticket

**Backlog kanban**: `66c4450ed2d04ad68c1b06e522169e6c`
**Features spec**: `336355b4-4d03-8185-9406-c5b4502a20fe`
**MVP scope**: `336355b4-4d03-81d1-818e-e68530984a2a`
**DB schema**: `336355b4-4d03-815c-929d-d097a7a4d0e9`
**Conventions**: `336355b4-4d03-81a2-97e6-f9fc18df0d87`

Run a refinement session for ticket: **$ARGUMENTS**

**Language**: all output must be in English — ticket descriptions, acceptance criteria, technical notes, Notion comments.

The PO reviews the ticket from a product perspective and the Dev reviews it from a technical + security + testability perspective (the Dev now owns Lead Dev, DevOps, and Tester concerns in one hat).

## Notion access

Both agents use the local wrapper — Notion MCP is not used anywhere:

```bash
node scripts/notion/notion.mjs get-page <page-id>
node scripts/notion/notion.mjs add-comment <page-id> "<text>"
node scripts/notion/notion.mjs set-property <page-id> "<field>" "<value>"
```

Requires `NOTION_TOKEN` in the shell env (auto-loaded from `.env` in the CWD).

---

## Step 0 — Context fetch and dependency check (YOU do this, before delegating to any agent)

Fetch the following pages yourself using the wrapper (`node scripts/notion/notion.mjs get-page <id>`) and store their full content:
1. The ticket: **$ARGUMENTS**
2. Features spec: `336355b4-4d03-8185-9406-c5b4502a20fe` — for the PO
3. MVP scope: `336355b4-4d03-81d1-818e-e68530984a2a` — for the PO
4. DB schema: `336355b4-4d03-815c-929d-d097a7a4d0e9` — for the Dev
5. Conventions: `336355b4-4d03-81a2-97e6-f9fc18df0d87` — for the Dev

**Dependency check**: if the ticket has entries in "Blocked By", fetch each of those tickets and check their status. If any dependency is not `Done` or `Validated`:
- Leave a comment listing which dependencies are not yet done and their current status
- **Stop the refinement** and inform the user — a ticket cannot be refined if its dependencies are not yet implemented

Each agent receives only the pages relevant to their role (see steps below).

---

## Step 1 — PO: Requirements review

Delegate to the PO agent. Pass:
- The full ticket content (from Step 0)
- The features spec and MVP scope content (from Step 0)

PO agent tasks:
- Assess clarity of the description and acceptance criteria:
  - Are the acceptance criteria complete, measurable, and testable?
  - Is the scope clear — what is IN and what is OUT?
  - Are there missing business rules or undefined edge cases?
- Produce a list of open questions and clarifications
- Do NOT modify the ticket yet — only report findings

**Capture** (concise — bullet points only): open questions, scope concerns, missing acceptance criteria.

---

## Step 2 — Dev: Technical + security + testability review

Delegate to the Dev agent. Pass:
- The full ticket content (from Step 0)
- The DB schema and conventions content (from Step 0)
- PO summary from Step 1

Dev agent tasks — the Dev wears all three hats (Lead Dev, DevOps, Tester):

**Lead Dev hat — approach and architecture**
- Which files need to be created or modified (schema, service, endpoints, tests)?
- Are there architectural concerns or risks?
- Does this touch existing logic that could break other features?
- Are the acceptance criteria technically testable?
- Are there missing technical constraints (validation rules, error cases, DB implications, transaction boundaries)?

**DevOps hat — security and infra constraints**
- Does this feature introduce new user inputs that need validation?
- Are there sensitive data fields (passwords, tokens, PII) that need special handling?
- Does this require DB schema changes — are there migration or integrity risks?
- Are there new env vars needed?
- Are there auth or permission requirements (auth middleware, admin-only routes)?

**Tester hat — what will need to be verified**
- Which acceptance criteria will be validated via curl vs. only in tests?
- Are there edge cases (concurrency, large payloads, expired tokens) worth calling out in the spec?

Produce a consolidated report:
- Proposed implementation approach
- Files to create/modify
- Security/infra constraints
- Testability notes
- Complexity estimate (Simple / Medium / Complex)
- Blocking questions

Do NOT modify the ticket yet.

**Capture** (concise — bullet points only): approach, files, security constraints, complexity, blocking questions.

---

## Step 3 — User validation (REQUIRED before updating the ticket)

Before touching the Notion ticket, present a consolidated summary to the user:

- **PO findings**: key questions and scope concerns
- **Dev assessment**: proposed implementation approach, architecture concerns, security/infra constraints, complexity estimate
- **Open questions**: anything unresolved that the user needs to answer

Then ask:
1. Do you agree with the proposed approach?
2. Are there any open questions you can answer now?
3. Anything to add or change before the ticket is updated?

**Wait for the user's response before proceeding to Step 4.** Incorporate their answers into the final update.

---

## Step 4 — Synthesis and ticket update

Based on both perspectives and the user's input, update the Notion ticket with:

**Refined description** — clear, complete, unambiguous

**Acceptance criteria** — each criterion must be:
- Written as a testable statement ("Given X, when Y, then Z")
- Covering the happy path, error cases, and relevant edge cases

**Technical approach** — agreed implementation plan:
- Files to create/modify
- Key design decisions
- Any constraints or warnings

**Security & infra constraints** — from the Dev's DevOps-hat review:
- Validation rules, sensitive fields, migration notes, env vars, auth requirements

**Open questions** — if any questions remain unresolved, list them explicitly with the name of whoever needs to answer them

**Status update** — only if the current ticket status is `Todo` or has no status set, update it to `Todo` to signal it is ready for implementation. If the ticket is already in any other status (e.g. `In Progress`, `In Review`), leave the status unchanged.

Leave a comment: "Refinement completed on [date] — ticket is ready for implementation." Include any key decisions made by the user during the validation step.

---

## Output

Present a summary of:
1. Key decisions made during refinement
2. Security/infra constraints identified by the Dev
3. Open questions still pending (if any)
4. Link to the updated Notion ticket
