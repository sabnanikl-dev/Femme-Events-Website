import type { PortableTextBlock } from "@portabletext/react";
import { sanityClient } from "./sanity";
import { posts as fallbackPosts, type Post as FallbackPost } from "../data/posts";

// Wider runtime type than the static fallback — Sanity returns Portable
// Text blocks for `body`, the static posts use a markdown-ish string.
// Both are renderable by BlogPost.tsx; the renderer branches on shape.
export interface Post extends Omit<FallbackPost, "body"> {
  body: string | PortableTextBlock[];
  imageHotspot?: {
    x?: number;
    y?: number;
  };
}

const POSTS_QUERY = `*[_type == "post"] | order(date desc){
  "slug": slug.current,
  title,
  excerpt,
  category,
  date,
  readTime,
  "image": image.asset->url,
  "imageHotspot": image.hotspot,
  body
}`;

const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  "slug": slug.current,
  title,
  excerpt,
  category,
  date,
  readTime,
  "image": image.asset->url,
  "imageHotspot": image.hotspot,
  body
}`;

// The static posts in src/data/posts.ts are demo/seed data only. They must
// never appear on the public website (where Sanity is always configured) —
// see issue #152. They are used solely for local development when Sanity is
// not wired up AND the developer explicitly opts in via VITE_USE_DEMO_POSTS.
const demoPosts: Post[] =
  !sanityClient && import.meta.env.VITE_USE_DEMO_POSTS === "true"
    ? fallbackPosts
    : [];

// Sync helpers for the initial render:
// - Sanity enabled  → return the "still loading" shape (null / undefined);
//   the async fetch fills in the real result.
// - Sanity disabled → resolve from the demo seed immediately (empty unless
//   the developer opted in), preserving the no-flash UX without ever
//   surfacing placeholders on the public site.

export function getInitialPosts(): Post[] | null {
  return sanityClient ? null : demoPosts;
}

export function getInitialPost(slug: string): Post | null | undefined {
  if (sanityClient) return undefined;
  return demoPosts.find((p) => p.slug === slug) ?? null;
}

export function formatPostDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export async function getPosts(): Promise<Post[]> {
  if (!sanityClient) return demoPosts;
  try {
    return await sanityClient.fetch<Post[]>(POSTS_QUERY);
  } catch {
    // CMS configured but unreachable: treat as "no journal posts yet" rather
    // than surfacing static placeholders on the public site (issue #152).
    return [];
  }
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!sanityClient) {
    return demoPosts.find((p) => p.slug === slug) ?? null;
  }
  try {
    return await sanityClient.fetch<Post | null>(POST_QUERY, { slug });
  } catch {
    // CMS configured but unreachable: don't render the static placeholder for
    // an old slug — let the caller redirect to /journal (issue #152).
    return null;
  }
}
