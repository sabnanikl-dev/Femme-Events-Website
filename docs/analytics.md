# Analytics (issue #15)

Privacy-conscious analytics for the Femme Events site. The implementation is
**provider-agnostic**: it supports **Plausible** and/or **Google Analytics 4**,
chosen entirely by which environment variables are set. With none set, analytics
is fully disabled — no script is injected and every tracking call is a silent
no-op. No personally identifiable information (names, emails, phone numbers,
event dates, message text) is ever sent.

All logic lives in [`src/lib/analytics.ts`](../src/lib/analytics.ts):
`initAnalytics()` (called once in `main.tsx`), `trackEvent(name, props)`, and
`trackPageview(path)` (GA4-only; Plausible auto-tracks SPA navigations).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `VITE_PLAUSIBLE_DOMAIN` | for Plausible | Site/data-domain registered in Plausible, e.g. `femmeevents.com` |
| `VITE_PLAUSIBLE_API_HOST` | no | Only for self-hosted Plausible. Defaults to `https://plausible.io` |
| `VITE_GA4_MEASUREMENT_ID` | for GA4 | Measurement ID, format `G-XXXXXXXXXX` |

`VITE_*` vars are inlined into the client bundle at build time, so they must be
set in Vercel **before** the production build runs.

## Setup (Karan)

Pick one provider (Plausible is recommended — no cookie banner needed).

### Option A — Plausible (recommended)
1. Create an account at <https://plausible.io> and add the site `femmeevents.com`.
2. In Vercel → Project → Settings → Environment Variables, add
   `VITE_PLAUSIBLE_DOMAIN=femmeevents.com` (Production, and Preview if desired).
3. Redeploy. Pageviews and events start flowing to the Plausible dashboard.

### Option B — Google Analytics 4
1. Create a GA4 property and copy its Measurement ID (`G-XXXXXXXXXX`).
2. In Vercel, add `VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX`.
3. Redeploy. Note: GA4 sets cookies — a consent banner may be required later for
   GDPR/CCPA compliance.

To verify, open the deployed site, then check the provider's realtime dashboard
and the browser Network tab for the analytics request.

## Tracked events

Page views are automatic (Plausible: built-in incl. SPA routes; GA4: sent on each
route change). Custom events:

| Event | Props | Fired when |
|---|---|---|
| `cta_inquiry_click` | `location` (`hero`/`service_card`/`process`/`vendors`/`faq`), `service` (service-card only) | Any "Let's Chat" / "Book Now" / section inquiry CTA |
| `nav_inquiry_click` | `location` (`nav_desktop`/`nav_mobile`) | Navbar "Inquiry" link |
| `inquiry_submit` | `location` (`inquiry_form`) | Inquiry form submitted successfully |
| `instagram_click` | `location` (`hero`/`footer`) | Instagram link |
| `email_click` | `location` (`footer`) | `mailto:` link |
| `phone_click` | `location` (`footer`) | `tel:` link |
| `vendor_link_click` | `type` (`website`/`instagram`), `vendor` (vendor name) | Link in the vendor overlay card |

Event props carry only safe metadata — never visitor-entered contents.
