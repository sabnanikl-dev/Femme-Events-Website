import { createClient, type SanityClient } from "@sanity/client";

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID;
const dataset = import.meta.env.VITE_SANITY_DATASET ?? "production";
const apiVersion = import.meta.env.VITE_SANITY_API_VERSION ?? "2024-01-01";

// When VITE_SANITY_PROJECT_ID is unset (dev / preview deploys without CMS
// wiring) the client is null and the data layer falls back to the static
// posts in src/data/posts.ts. PR B will populate this in Vercel.
export const sanityClient: SanityClient | null = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      // Fail fast on read errors so the UI degrades quickly. Every data
      // helper (posts/vendors/testimonials) already falls back to static
      // content on a rejected fetch, but the client defaults to a long
      // 5-minute request ceiling and retries failed reads (maxRetries
      // defaults to 5) with exponential back-off — so a blocked or stalled
      // read can leave the Journal sitting on "Loading…" instead of reaching
      // that fallback (see issue #124). timeout lowers the per-request
      // ceiling to 10 seconds; maxRetries: 0 skips retrying a doomed
      // public-CDN read.
      maxRetries: 0,
      timeout: 10000,
    })
  : null;
