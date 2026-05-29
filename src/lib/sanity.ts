import { createClient, type SanityClient } from "@sanity/client";

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID;
const dataset = import.meta.env.VITE_SANITY_DATASET ?? "production";
const apiVersion = import.meta.env.VITE_SANITY_API_VERSION ?? "2024-01-01";

// When VITE_SANITY_PROJECT_ID is unset (local dev without CMS wiring) the
// client is null. Public content then resolves to an empty state — the static
// posts in src/data/posts.ts are only used as a local dev seed when
// VITE_USE_DEMO_POSTS is also "true" (see src/lib/posts.ts, issue #152).
// Production / preview deploys always set the project ID in Vercel env vars.
export const sanityClient: SanityClient | null = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      // Fail fast on read errors so the UI degrades quickly. Each data helper
      // resolves a rejected fetch to a graceful state (posts → empty Journal;
      // vendors/testimonials → static content), but the client defaults to a
      // long 5-minute request ceiling and retries failed reads (maxRetries
      // defaults to 5) with exponential back-off — so a blocked or stalled
      // read can leave the Journal sitting on "Loading…" instead of reaching
      // that state (see issue #124). timeout lowers the per-request ceiling to
      // 10 seconds; maxRetries: 0 skips retrying a doomed public-CDN read.
      maxRetries: 0,
      timeout: 10000,
    })
  : null;
