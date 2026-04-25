import { createClient, type SanityClient } from "@sanity/client";

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID;
const dataset = import.meta.env.VITE_SANITY_DATASET ?? "production";
const apiVersion = import.meta.env.VITE_SANITY_API_VERSION ?? "2024-01-01";

// When VITE_SANITY_PROJECT_ID is unset (dev / preview deploys without CMS
// wiring) the client is null and the data layer falls back to the static
// posts in src/data/posts.ts. PR B will populate this in Vercel.
export const sanityClient: SanityClient | null = projectId
  ? createClient({ projectId, dataset, apiVersion, useCdn: true })
  : null;
