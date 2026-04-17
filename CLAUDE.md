# CLAUDE.md — Development Process

> This file defines the rules for all AI agents working on this repository.
> Every agent MUST read and follow this file before making changes.

---

## Multi-Agent Development Process

### Core Rules

1. **ALL code requires cross-QA from the OTHER agent before merge**
2. **No self-approvals. Ever.**
3. **All work tracked via GitHub Issues** — every PR must reference an Issue
4. **Human (Karan) gives go/no-go. Hermes merges on their behalf.**

### Agent Roles

- **Hermes**: Orchestrator + Contributor. Manages GitHub via API/CLI. Tracks issues, reviews PRs, merges on human approval.
- **Claude Code**: Lead Developer in Antigravity. Builds core features. Has GitHub MCP server connected.
- **Karan**: Final gate. Receives plain-English summaries (no code diffs). Gives go/no-go. Never reviews technical PR diffs directly.

### Workflow

1. Task assigned → GitHub Issue created with assignee
2. Assigned agent creates branch: `fe/<agent>-<description>`
3. Agent builds feature, opens PR linked to the Issue
4. OTHER agent performs code review on the PR
5. If Claude Code's PR → Hermes reviews it, sends Karan summary
6. If Hermes's PR → Claude Code reviews it
7. Karan approves → Hermes merges to main

### Branch Naming

- `fe/hermes-<description>` — Hermes work
- `fe/cd-<description>` — Claude Code work
- `hotfix/<description>` — urgent fixes

### PR Requirements

- Must be linked to a GitHub Issue (`Closes #N` in description)
- Must summarize changes and reasoning
- No unrelated refactoring in the same PR
- All changes tested before opening the PR
- No `console.log` or debug code left in production

### PR Review Standards

- **Correctness** — does it do what the Issue asks?
- **Edge cases** — what could break?
- **Security** — no leaked keys, unsafe inputs, or XSS vectors
- **Consistency** — matches existing codebase style and conventions
- **No console.log** in production code

### Pitfalls (DO NOT)

- Push directly to `main` — only merge PRs after cross-QA + human approval
- Create code without an Issue — every PR must trace back to a task
- Include multiple unrelated changes in one PR — one task, one PR
- Self-approve or merge your own PR

---

## Project: Femme Events Website

### Overview

Femme Events — wedding coordination and event planning brand. React + TypeScript frontend built with Vite.

### Tech Stack

- React 18+ with TypeScript
- Vite as build tool
- Tailwind CSS (or similar) for styling
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
- Natural, conversational tone — no corporate language
- Content voice: punchy, warm, personal

### Known Context

- Domain: femmeevents.com (registered on domain.com, DNS → Vercel pending)
- Current site is in early phase — missing SEO, form backend, and key conversion features
- All changes from PRs #2-#15 should be tracked as separate issues for future work
