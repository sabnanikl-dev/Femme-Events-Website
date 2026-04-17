---
name: end-session-audit
description: "Mandatory branch audit checklist that Claude Code runs before wrapping up any work session."
---

# End-Session Audit Checklist

Run this audit before any "I'm done" or "All set" message to the user.

## Steps

1. **Audit all branches for commits ahead of main**
   - `git fetch origin`
   - `git branch --sort=-committerdate | head -20`
   - Compare each `fe/cd-*` branch against `main`: `git log main..origin/<branch> --oneline`
   - List any branches with unmerged commits

2. **Check that every commit traces back to an open issue**
   - For each branch with unmerged commits, identify which GitHub Issue(s) it addresses
   - If a commit has no corresponding Issue, flag it: "ORPHANED — no Issue found"

3. **Flag orphaned fixes that need Issues filed**
   - Any work on `preview/*`, `integration/*`, or similar branches MUST have a backing Issue
   - If not, warn: "This commit has no Issue — file one before pushing"

4. **Open any missing PRs**
   - For every branch that has commits ahead of main and an open Issue, ensure a PR exists
   - If no PR exists, create one linked to the Issue: `gh pr create --issue #N --title "..." --body "..."`

5. **Push anything not yet on remote**
   - `git status` — check for uncommitted changes
   - If there are uncommitted changes that belong to an open Issue, commit them with `git commit -m "fix: ... (see #N)"` and push
   - If there are uncommitted changes with no Issue, warn: "Changes detected but no Issue to link. File an Issue first."

6. **Report summary to user**
   - List branches ahead of main
   - List any Issues that have open PRs vs. no PRs
   - List any orphaned work that needs attention
   - Confirm: "All work is pushed, all PRs are linked to Issues, no orphaned branches"

## Rules

- NEVER commit to `main` directly
- NEVER create a preview or integration branch without a backing Issue
- NEVER claim session is done until all checks pass
