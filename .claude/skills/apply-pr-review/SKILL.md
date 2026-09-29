---
name: apply-pr-review
description: Processes the user's GitHub PR review comments — applies valid changes directly or pushes back with a reasoned response if a comment contradicts the architecture, standards, or established patterns. The senior Dev handles every comment (there is no separate Lead Dev agent).
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

Store the resolved `$REPO` and `$PR_NUMBER` — use them in every subsequent `gh api` call, and pass them to the Dev so it never needs to resolve them itself.

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

**Extract the Notion ticket ID from the branch name** — branch names follow `feat/KEI-X-slug` or `fix/KEI-X-slug`. Extract `KEI-X`, then fetch the full ticket via the wrapper:

```bash
node scripts/notion/notion.mjs get-page <page-id>
```

Store its full content: title, description, acceptance criteria, technical approach, PR URL, comments.

Collect:
- Resolved `$REPO` (e.g. `Keimelion/Keimelion-API`)
- PR number and branch name
- Only actionable comments (not outdated, not already replied to, not from dismissed reviews)
- Full Notion ticket content

---

## Step 1 — Read the code and delegate (YOU do this)

Read the files touched by the comments to understand the context. Then delegate all comments to the Dev agent in a single pass — the Dev holds every hat (implementation, architecture, quality, security, testing), so there is no bucketing.

Include in the delegation prompt:
- Resolved repo slug (e.g. `Keimelion/Keimelion-API`), PR number, branch name
- **Full Notion ticket content** (description, acceptance criteria, technical approach)
- Every comment: comment id, file path, line number, commented line(s), comment body
- **Instruction: do NOT commit or push. Do NOT update Notion.** You (the orchestrator) handle the commit, push, and Notion update in Step 2.

Dev agent tasks — for each comment:

### If the change is coherent and should be applied:
1. Apply the fix directly (Edit/Write). If the change requires architectural judgment (naming, abstraction, boundary), the Dev exercises that judgment using the coding standards and the surrounding code as the reference — the same standard it applies during a fresh implementation.
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

## Step 2 — Commit and push (YOU do this, after the Dev completes)

Once all changes are applied, commit and push from the main context. The commit message follows the `<type>: <identifier> <description> (KEI-N)` convention documented in the `build-feature` skill — reuse the identifier of the parent PR (endpoint path, service, or module):

```bash
git add <all modified files — explicit, never git add .>
git commit -m "fix: <identifier> apply PR review feedback (KEI-X)"
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

## Step 3 — Notify the user

Inform the user that the PR is updated and ready for their re-review. Include the PR URL so they can go directly to it.

---

## Output

Present to the user:
1. **Applied** — list of comments that were implemented (file:line + what changed)
2. **Pushed back** — list of comments where the Dev disagreed (file:line + one-line reason)
3. **PR link** — so the user can see the inline replies and re-review
