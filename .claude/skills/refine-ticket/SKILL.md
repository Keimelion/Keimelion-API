---
name: refine-ticket
description: Collaborative ticket refinement — the PO, Lead Dev, DevOps, and Dev discuss a Notion ticket together to clarify requirements, identify edge cases, agree on technical approach, and update the ticket with a refined spec before implementation starts.
argument-hint: <Notion ticket URL or ID>
---

# Workflow: Refine Ticket

**Backlog kanban**: `66c4450ed2d04ad68c1b06e522169e6c`
**Features spec**: `336355b4-4d03-8185-9406-c5b4502a20fe`
**MVP scope**: `336355b4-4d03-81d1-818e-e68530984a2a`
**DB schema**: `336355b4-4d03-815c-929d-d097a7a4d0e9`
**Conventions**: `336355b4-4d03-81a2-97e6-f9fc18df0d87`

Run a refinement session for ticket: **$ARGUMENTS**

Each agent reviews the ticket from their own perspective, raises questions and concerns, and the ticket is updated with a complete, unambiguous spec ready for implementation.

---

## Step 0 — Context fetch and dependency check (YOU do this, before delegating to any agent)

Fetch the following pages yourself using your Notion MCP tools and store their full content:
1. The ticket: **$ARGUMENTS**
2. Features spec: `336355b4-4d03-8185-9406-c5b4502a20fe` — for PO only
3. MVP scope: `336355b4-4d03-81d1-818e-e68530984a2a` — for PO only
4. DB schema: `336355b4-4d03-815c-929d-d097a7a4d0e9` — for Lead Dev and Dev only
5. Conventions: `336355b4-4d03-81a2-97e6-f9fc18df0d87` — for Lead Dev and Dev only

**Dependency check**: if the ticket has entries in "Blocked By", fetch each of those tickets and check their status. If any dependency is not `Validated`:
- Leave a comment listing which dependencies are not yet validated and their current status
- **Stop the refinement** and inform the user — a ticket cannot be refined if its dependencies are not yet implemented

Each agent receives only the pages relevant to their role (see steps below) — **no agent should call notion-fetch or notion-search**.

---

## Step 1 — PO: Requirements review

Delegate to the PO agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- The features spec and MVP scope content (from Step 0)
- **Instruction: do NOT call any Notion MCP tools to read — all content is already provided. Only use Notion MCP to write if explicitly asked.**

PO agent tasks:
- Assess clarity of the description and acceptance criteria:
  - Are the acceptance criteria complete, measurable, and testable?
  - Is the scope clear — what is IN and what is OUT?
  - Are there missing business rules or undefined edge cases?
- Produce a list of open questions and clarifications
- Do NOT modify the ticket yet — only report findings

**Capture the PO's full findings to pass forward.**

---

## Step 2 — Lead Dev: Technical review

Delegate to the Lead Dev agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- The DB schema and conventions content (from Step 0)
- **PO findings** (full output from Step 1)
- **Instruction: do NOT call any Notion MCP tools to read — all content is already provided. Only use Notion MCP to write if explicitly asked.**

Lead Dev agent tasks:
- Assess technical feasibility and approach:
  - Which files need to be created or modified?
  - Are there architectural concerns or risks?
  - Does this touch existing logic that could break other features?
  - Are the acceptance criteria technically testable?
  - Are there missing technical constraints (validation rules, error cases, DB implications)?
- Produce a technical assessment and a proposed implementation approach
- Raise any blocking questions or dependencies

**Capture the Lead Dev's full assessment to pass forward.**

---

## Step 3 — DevOps: Security & Infra review

Delegate to the DevOps agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- **PO findings** (full output from Step 1)
- **Lead Dev assessment** (full output from Step 2)
- No spec pages needed — DevOps works from the ticket and prior findings only
- **Instruction: do NOT call any Notion MCP tools to read — all content is already provided. Only use Notion MCP to write if explicitly asked.**

DevOps agent tasks:
- Identify security and infra constraints upfront:
  - Does this feature introduce new user inputs that need validation?
  - Are there sensitive data fields (passwords, tokens, PII) that need special handling?
  - Does this require DB schema changes — are there migration or integrity risks?
  - Are there new env vars needed?
  - Are there auth or permission requirements?
- Produce a list of security/infra constraints and recommendations to include in the spec
- Do NOT modify the ticket yet — only report findings

**Capture the DevOps constraints to pass forward.**

---

## Step 4 — Dev: Implementation review

Delegate to the Dev agent. Include in the delegation prompt:
- The full ticket content (from Step 0)
- The DB schema and conventions content (from Step 0)
- **PO findings** (full output from Step 1)
- **Lead Dev assessment** (full output from Step 2)
- **DevOps constraints** (full output from Step 3)
- **Instruction: do NOT call any Notion MCP tools to read — all content is already provided. Only use Notion MCP to write if explicitly asked.**

Dev agent tasks:
- Review the proposed implementation approach:
  - Is it consistent with existing patterns in the codebase?
  - Are there simpler or more idiomatic ways to implement it?
  - Identify any missing details needed to start coding without ambiguity
- Estimate complexity: Simple / Medium / Complex
- Flag anything that would block implementation

---

## Step 5 — User validation (REQUIRED before updating the ticket)

Before touching the Notion ticket, present a consolidated summary to the user:

- **PO findings**: key questions and scope concerns raised
- **Lead Dev assessment**: proposed implementation approach, architecture concerns, dependencies
- **DevOps constraints**: security, validation, migration, auth requirements
- **Dev review**: complexity estimate, missing details, implementation blockers
- **Open questions**: anything unresolved that the user needs to answer

Then ask the user:
1. Do you agree with the proposed approach?
2. Are there any open questions you can answer now?
3. Anything to add or change before the ticket is updated?

**Wait for the user's response before proceeding to Step 6.** Incorporate their answers into the final update.

---

## Step 6 — Synthesis and ticket update

Based on all four perspectives and the user's input, update the Notion ticket with:

**Refined description** — clear, complete, unambiguous

**Acceptance criteria** — each criterion must be:
- Written as a testable statement ("Given X, when Y, then Z")
- Covering the happy path, error cases, and relevant edge cases

**Technical approach** — agreed implementation plan:
- Files to create/modify
- Key design decisions
- Any constraints or warnings

**Security & infra constraints** — from the DevOps review:
- Validation rules, sensitive fields, migration notes, env vars, auth requirements

**Open questions** — if any questions remain unresolved, list them explicitly with the name of whoever needs to answer them

**Status update** — only if the current ticket status is `Todo` or has no status set, update it to `Todo` to signal it is ready for implementation. If the ticket is already in any other status (e.g. `In Progress`, `In Review`), leave the status unchanged.

Leave a comment: "Refinement completed on [date] — ticket is ready for implementation." and include any key decisions made by the user during the validation step.

---

## Output

Present a summary of:
1. Key decisions made during refinement
2. Security/infra constraints identified by DevOps
3. Open questions still pending (if any)
4. Link to the updated Notion ticket
