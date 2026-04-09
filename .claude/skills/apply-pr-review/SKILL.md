---
name: apply-pr-review
description: Processes the user's GitHub PR review comments — applies valid changes directly or pushes back with a reasoned response if a comment contradicts the architecture, standards, or established patterns. The Lead Dev handles architectural/quality comments; the Dev handles pure implementation changes.
argument-hint: <PR number | ticket ID (KEI-X) | leave empty to use current branch>
---

# Workflow: Apply PR Review

For each comment: apply the change if it is coherent, or reply with a clear justification if it contradicts the project's architecture, standards, or established patterns.

**Language**: all output must be in English — code changes, GitHub replies, commit messages, Notion updates.

---

## Step 0 — Resolve PR, fetch ticket and review comments (YOU do this)

**Resolve the PR** depending on what was provided as argument:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# No argument → use current branch
gh pr view --json number,title,headRefName,baseRefName,url

# PR number provided
gh pr view $ARGUMENTS --json number,title,headRefName,baseRefName,url

# Ticket ID provided (e.g. KEI-32) → find the PR whose branch starts with that ID
gh pr list --json number,title,headRefName,url \
  | jq '.[] | select(.headRefName | test("KEI-32"))'
```

Store the resolved `$REPO` and `$PR_NUMBER` — use them in every subsequent `gh api` call, and pass them to agents so they never need to resolve them themselves.

```bash
# Get all inline review comments — keep only actionable ones:
# - position != null  → comment is on current diff (not outdated)
# - in_reply_to_id == null → top-level comment, not a reply
gh api repos/$REPO/pulls/$PR_NUMBER/comments \
  --jq '[.[] | select(.position != null and .in_reply_to_id == null)
         | {id: .id, path: .path, line: .line, body: .body}]'

# For each retained comment, check if it already has a reply
# (indicates it was already addressed — skip it)
gh api repos/$REPO/pulls/$PR_NUMBER/comments \
  --jq '[.[] | select(.in_reply_to_id != null) | .in_reply_to_id]'
# Any comment whose id appears in this reply list is already addressed → skip it

# Get top-level review bodies (CHANGES_REQUESTED only — skip DISMISSED)
gh api repos/$REPO/pulls/$PR_NUMBER/reviews \
  --jq '[.[] | select(.state == "CHANGES_REQUESTED") | {id: .id, body: .body}]'
```

**After filtering, if no actionable comments remain — inform the user ("all comments are already addressed or outdated") and stop.**

**Extract the Notion ticket ID from the branch name** — branch names follow `feat/KEI-X-slug` or `fix/KEI-X-slug`. Extract `KEI-X`, then fetch the full ticket from the backlog (`66c4450ed2d04ad68c1b06e522169e6c`) using your Notion MCP tools. Store its full content: description, acceptance criteria, technical approach, and all comments.

Collect:
- Resolved `$REPO` (e.g. `Zalbani/Keimelion-API`)
- PR number and branch name
- Only actionable comments (not outdated, not already replied to, not from dismissed reviews)
- Full Notion ticket content

---

## Step 1 — Classify comments (YOU do this, before delegating)

Read the relevant source files to understand the context of each comment. Use the ticket content (description, acceptance criteria, technical approach) as the reference frame when judging whether a comment is coherent. Then classify every comment into one of two buckets:

**Bucket A — Architectural / Quality** (delegate to Lead Dev):
- Concerns about design patterns, abstractions, or project structure
- Code quality: naming, complexity, type safety, duplication
- Standards violations (coding standards, conventions)
- Anything requiring judgment against the existing architecture

**Bucket B — Implementation** (delegate to Dev):
- Mechanical changes: rename a variable, fix a typo, adjust a value
- Missing validation, error handling, or a test case
- Pure bug fixes with no design ambiguity

Comments that span both concerns go to the Lead Dev.

For each comment, pass the exact commented line(s) only. Agents have Read access and will read the file themselves if they need more context.

---

## Step 2A — Lead Dev: Apply or push back on architectural/quality comments

If Bucket A is non-empty, delegate to the Lead Dev agent. Include in the delegation prompt:
- Resolved repo slug (e.g. `Zalbani/Keimelion-API`), PR number, branch name
- **Full Notion ticket content** (description, acceptance criteria, technical approach)
- Each comment in Bucket A: comment id, file path, line number, comment body
- Each comment: file path, line number, commented line(s), comment body
- Read files as needed for context (you have Read access)
- **Instruction: do NOT call Notion MCP tools. Do NOT commit or push.**

Lead Dev agent tasks — for each comment:

### If the change is coherent and should be applied:
1. Apply the fix directly (Edit/Write)
2. Run `npm test -- --run`, `npx tsc --noEmit`, `npx eslint src/` — must be clean
3. Reply to the comment on GitHub:
   ```bash
   gh api repos/REPO/pulls/PR_NUMBER/comments/COMMENT_ID/replies \
     -f body="Applied. <one-line explanation of what was changed>"
   ```

### If the change contradicts the architecture, standards, or established patterns:
1. Do NOT apply it
2. Reply to the comment on GitHub explaining why:
   ```bash
   gh api repos/REPO/pulls/PR_NUMBER/comments/COMMENT_ID/replies \
     -f body="<clear, respectful explanation: current approach + why the suggestion would cause Y problem>"
   ```

**Capture**: list of files modified, list of comments applied, list of comments pushed back (with reasoning summary).

---

## Step 2B — Dev: Apply implementation comments

**Run this step only after Step 2A is fully complete.** If Step 2A modified any files that are also referenced in Bucket B comments, re-read those files now to get their updated content before delegating.

If Bucket B is non-empty, delegate to the Dev agent. Include in the delegation prompt:
- Resolved repo slug, PR number, branch name
- **Full Notion ticket content** (description, acceptance criteria, technical approach)
- Each comment in Bucket B: comment id, file path, line number, comment body
- Each comment: file path, line number, commented line(s), comment body
- Read files as needed for context — for files modified in Step 2A, read them now to get their updated state
- **Instruction: do NOT call Notion MCP tools. Do NOT commit or push.**

Dev agent tasks — for each comment:
1. Apply the fix directly (Edit/Write)
2. Run `npm test -- --run` and `npx tsc --noEmit` — must be clean
3. Reply to the comment on GitHub:
   ```bash
   gh api repos/REPO/pulls/PR_NUMBER/comments/COMMENT_ID/replies \
     -f body="Applied."
   ```

**Capture**: list of files modified, list of comments applied.

---

## Step 3 — Commit and push (YOU do this, after both agents complete)

Once all changes are applied, commit and push from the main context:

```bash
git add <all modified files — explicit, never git add .>
git commit -m "fix: apply PR review feedback (KEI-X)"  # replace KEI-X with the actual ticket ID from Step 0
git push
```

Then leave a summary comment on the PR:

```bash
gh pr comment $ARGUMENTS --body "$(cat <<'EOF'
## Review feedback applied

### Changes applied
- file:line — description

### Points of disagreement
- file:line — summary of pushback (see inline reply for details)

All checks pass: tests ✅ · types ✅ · lint ✅
EOF
)"
```

---

## Step 4 — Notify the user

Inform the user that the PR is updated and ready for their re-review. Include the PR URL so they can go directly to it.

---

## Output

Present to the user:
1. **Applied** — list of comments that were implemented (file:line + what changed)
2. **Pushed back** — list of comments where the agent disagreed (file:line + one-line reason)
3. **PR link** — so the user can see the inline replies and re-review
