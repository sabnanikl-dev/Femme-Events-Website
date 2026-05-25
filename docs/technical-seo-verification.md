# Technical SEO verification — PAPI-38 / PAPI-46

This document records the technical SEO baseline for the Femme Events website and the verification posture needed before marking PAPI-38/PAPI-46 fully complete in production.

## Static crawl and share assets

| Asset / route | Expected result | Notes |
|---|---|---|
| `/robots.txt` | `200`, `text/plain`, allows public crawl, points to `https://femmeevents.com/sitemap.xml` | Static file in `public/robots.txt`. |
| `/sitemap.xml` | `200`, XML sitemap content type, includes current self-canonical public routes | Includes `/` only until non-home SPA routes have route-specific canonical metadata. `#services` and `#inquiry-form` are homepage sections, not standalone crawlable routes, so they are intentionally not separate sitemap entries until dedicated routes exist. Dynamic journal-post sitemap generation is deferred until published post inventory is stable. |
| `/og-image.png` | `200`, `image/png`, 1200×630 | Branded share image using approved Femme palette. |
| Direct app routes | `/`, `/about`, `/what-happens-next`, `/journal` load without SPA fallback serving assets as HTML | Verify locally and again after deployment. |

## Structured data guardrails

The homepage JSON-LD is limited to `LocalBusiness` + `EventPlanningService` because those business facts are visible or already used on the site. It uses one stable business identity: `https://femmeevents.com/#organization`.

Do not add these until the page has matching visible content and/or approved source data:

- `FAQPage` schema — visible FAQ copy exists, but schema publication should wait for a dedicated copy review so answers are exactly approved.
- `BreadcrumbList` schema — no visible breadcrumb UI exists on the current routes.
- Non-home route sitemap entries — defer `/about`, `/what-happens-next`, and `/journal` until they emit route-specific canonical metadata instead of the homepage canonical URL.
- Review/rating/award claims — no approved visible evidence is present.
- Public directory, GBP, or Search Console actions — out of repo scope and require explicit approval.

## Analytics and conversion posture

Analytics remains provider-agnostic and privacy-conscious (`docs/analytics.md`). Conversion events currently tracked without visitor-entered PII:

- `cta_inquiry_click` for inquiry CTAs, with safe `location` and optional package category.
- `nav_inquiry_click` for navigation inquiry links.
- `inquiry_submit` after successful form submission, with `location` and selected package category only.
- `email_click`, `phone_click`, and `instagram_click` for contact/social clicks.
- `vendor_link_click` with safe vendor/link metadata.

Recommended UTM convention for campaigns:

```text
utm_source=<platform-or-partner>
utm_medium=<organic_social|paid_social|email|vendor_referral|qr|directory>
utm_campaign=<yyyy-mm-short-campaign-name>
utm_content=<creative-or-placement>
```

Keep UTM values lowercase, hyphenated, and non-personal. Do not put names, emails, phone numbers, event dates, venues, or inquiry details in UTM values.

## Local validation commands

```bash
npm run lint
npm run verify:seo
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
curl -I http://127.0.0.1:4173/robots.txt
curl -I http://127.0.0.1:4173/sitemap.xml
curl -I http://127.0.0.1:4173/og-image.png
```

## Post-deploy verification checklist

Run after the PR is merged and Vercel deploys production:

```bash
curl -I https://femmeevents.com/robots.txt
curl -I https://femmeevents.com/sitemap.xml
curl -I https://femmeevents.com/og-image.png
curl -I https://femmeevents.com/about
curl -I https://femmeevents.com/what-happens-next
curl -I https://femmeevents.com/journal
```

Then open the production site in a browser and verify:

- No browser-console runtime errors on homepage and direct routes.
- The JSON-LD parses as valid JSON and contains no masked contact values.
- The OG image resolves as `image/png` and displays in a link-preview debugger.
- No unsupported claims, reviews, awards, or unapproved service/category assertions were added.
