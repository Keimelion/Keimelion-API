---
name: document-feature
description: Updates Notion spec pages (DB schema, features spec, MVP scope) to reflect what was actually implemented for a validated ticket.
argument-hint: <Notion ticket URL or ID>
---

# Workflow: Document Feature

Synchronise Notion documentation with the implemented code for ticket: **$ARGUMENTS**

---

## Step 0 — Context fetch (YOU do this, before delegating)

Fetch the following and store their full content:
1. The ticket: **$ARGUMENTS**
2. DB schema page: `336355b4-4d03-815c-929d-d097a7a4d0e9`
3. Features spec page: `336355b4-4d03-8185-9406-c5b4502a20fe`
4. MVP scope page: `336355b4-4d03-81d1-818e-e68530984a2a`

---

## Step 1 — Doc Writer: Documentation update

Delegate to the Doc Writer agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- The current content of the DB schema, features spec, and MVP scope pages (from Step 0)
- **Instruction: do NOT call notion-fetch — all content is already provided. Only use Notion MCP to write.**

Doc Writer agent tasks:
- Read every file listed in "Files Involved" on the ticket
- Determine which Notion pages need updating based on what actually changed:
  - **DB schema** — if `src/db/schema/index.ts` was modified
  - **Features spec** — if new endpoints or business rules were introduced
  - **MVP scope** — if the feature was part of the V1 scope list
- Make targeted updates to each relevant page
- Leave a comment on the ticket listing which pages were updated

---

## Output

Present a summary of:
1. Pages updated and what changed in each
2. Pages skipped and why
3. Link to the ticket
