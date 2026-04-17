# AGENTS.md — Multi-Agent Development Process

> This file defines the rules for ALL AI agents working on this repository.
> Every agent MUST read and follow this file before making changes.
> This applies to Claude Code, Codex, GPT tools, and any other coding agent.

---

## Identifying Yourself

Before starting any work, determine which agent you are:

- **If you are Claude Code, Codex, GPT-5.4, or any Lead Developer agent:** You write code, build features, and fix bugs. You do NOT merge your own work. You do NOT review your own PRs.
- **If you are Hermes:** You are the Orchestrator. You handle quick fixes, code reviews, GitHub API operations, and merge on behalf of the human. You also verify all merges actually succeeded.
- **If you are Karan (human):** You are the final gate. You receive plain-English go/no-go summaries. You never review technical PR diffs or raw code.

---

## Agent Roles

| Agent | Role | Tools |
|-------|------|-------|
| **Hermes** | Orchestrator + Contributor + Reviewer | Telegram, GitHub API, Terminal |
| **Lead Dev** | Code implementation | IDE (Antigravity, VS Code, Codex CLI/app, Claude Code) |
| **Karan** | Final approver | Telegram — gives green-light, never reviews code diffs |

---

## Core Rules

1. **ALL code requires cross-QA from a DIFFERENT agent before merge**
2. **No self-approvals. Ever.**
3. **All work tracked via GitHub Issues** — every PR must reference an Issue (`Closes #N`)
4. **Karan gives go/no-go. Hermes merges on their behalf.**
5. **Never report success without verification** — always check the actual state after an operation (merge, push, deployment) before declaring it done.

---

## Workflow (Issue → Branch → Code → Review → Merge)

1. Task assigned → GitHub Issue created with assignee
2. Assigned agent creates branch: `fe/<agent>-<description>`
3. Agent builds feature, opens PR linked to the Issue
4. OTHER agent performs code review on the PR
5. If Lead Dev's PR → Hermes reviews it, sends Karan a plain-English summary
6. If Hermes's PR → Lead Dev reviews it
7. Karan approves → Hermes merges to main
8. Hermes verifies merge succeeded (check PR `merged: true` state) before reporting

---

## Branch Naming

- `fe/hermes-<description>` — Hermes work
- `fe/cd-<description>` — Claude Code work
- `fe/codex-<description>` — Codex work
- `fe/gpt-<description>` — GPT agent work
- `hotfix/<description>` — urgent fixes
- `preview/all-issues` — integration branch (use sparingly, clean up after merge)

---

## PR Requirements

- Must be linked to a GitHub Issue (`Closes #N` in description)
- Must summarize changes and reasoning
- No unrelated refactoring in the same PR
- All changes tested before opening the PR
- No `console.log` or debug code left in production
- Commit one logical change at a time — no mega-commits

---

## PR Review Standards

- **Correctness** — does it do what the Issue asks?
- **Edge cases** — what could break?
- **Security** — no leaked keys, unsafe inputs, or XSS vectors
- **Consistency** — matches existing codebase style and conventions
- **Performance** — no obvious regressions (heavy dependencies, blocking renders)
- **No console.log** in production code

---

## Pitfalls (DO NOT)

- Push directly to `main` — only merge PRs after cross-QA + human approval
- Create code without an Issue — every PR must trace back to a task
- Include multiple unrelated changes in the same PR — one task, one PR
- Self-approve or merge your own PR
- Leave work stranded on a branch — before declaring PR work complete, audit every `fe/` branch. Close stale branches. Open PRs only for the most recent branch, close older ones.
- Commit directly to a preview or integration branch without a backing Issue — any fix discovered during testing must be filed as a GitHub Issue first. No ad-hoc commits on branches like `preview/all-issues` without Issue linkage.
- **Report merge success without verifying** — always check the PR state after a merge API call and confirm `merged: true` before reporting success. This is non-negotiable.

---

## Project: Femme Events Website

### Overview

Femme Events — wedding coordination and event planning brand. React + TypeScript frontend built with Vite.

### Tech Stack

- React 18+ with TypeScript
- Vite as build tool
- Tailwind CSS for styling
- Component-based architecture in `src/components/`

### Coding Standards

- TypeScript strict mode
- Functional components with hooks
- Consistent naming: PascalCase for components, camelCase for utilities
- No inline styles — use CSS classes/Tailwind
- Responsive-first design (mobile-first breakpoints)

### Brand Guidelines (MUST FOLLOW)

- Use only the established 13-color palette (defined in brand files)
- Fonts must match brand guidelines
- Natural, conversational tone — no corporate speak
- Content voice: punchy, warm, personal

### Known Context

- Domain: **femmeevents.com** (double 'e', not femmevents.com)
- Headless CMS: Sanity.io for blog management (non-technical user: Amanda)
- DNS: Registered on domain.com, Vercel deployment pending
- Branch protection active on `main` — requires PRs, blocks force-pushes
