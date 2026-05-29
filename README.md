# Femme Events Website

Marketing site for **Femme Events** — an Atlanta-based wedding coordination and
design studio. Built with React + TypeScript on Vite, styled with Tailwind CSS,
with journal/blog, testimonials, and vendor content served from Sanity CMS
without static fallback content.

## Tech stack

- React 19 + TypeScript (strict)
- Vite 6 build tooling
- Tailwind CSS v4
- React Router
- Sanity CMS (`studio/`) for journal, testimonials, and vendors
- Formspree for inquiry-form submissions

## Run locally

**Prerequisites:** Node.js 20.19+ or 22.12+ (required by `@vitejs/plugin-react` and `@portabletext/react`)

```bash
npm install
npm run dev      # starts Vite on http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build to dist/
npm run preview  # preview the production build
npm run lint     # tsc --noEmit typecheck
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values. All are `VITE_`-prefixed
and read in the browser, so none are secrets. The same values must be set in the
Vercel project (Production + Preview).

| Variable | Purpose |
|----------|---------|
| `VITE_FORMSPREE_ENDPOINT` | Inquiry form submission endpoint |
| `VITE_SANITY_PROJECT_ID` | Sanity project ID (unset → CMS-backed sections render empty states) |
| `VITE_SANITY_DATASET` | Sanity dataset (default `production`) |
| `VITE_SANITY_API_VERSION` | Sanity API version (default `2024-01-01`) |
| `VITE_PLAUSIBLE_DOMAIN` / `VITE_GA4_MEASUREMENT_ID` | Optional analytics (see `docs/analytics.md`) |

## Project layout

- `src/` — application code (components, pages, data, lib)
- `components/ui/` — shared UI primitives reachable via the `@` alias
- `public/` — static assets served as-is (fonts, photos, logos)
- `studio/` — Sanity Studio (CMS) source, deployed separately
- `docs/` — analytics and local-development notes

## Contributing

All work follows the multi-agent process in **`AGENTS.md`**: every change traces
to a GitHub Issue, lands on a branch, and is cross-reviewed before merge. Read
`AGENTS.md` before making changes.
