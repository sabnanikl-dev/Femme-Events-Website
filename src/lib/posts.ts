import type { PortableTextBlock } from "@portabletext/react";
import { sanityClient } from "./sanity";
import { posts as fallbackPosts, type Post as FallbackPost } from "../data/posts";

// Wider runtime type than the static fallback — Sanity returns Portable
// Text blocks for `body`, the static posts use a markdown-ish string.
// Both are renderable by BlogPost.tsx; the renderer branches on shape.
export interface Post extends Omit<FallbackPost, "body"> {
  body: string | PortableTextBlock[];
}

const POSTS_QUERY = `*[_type == "post"] | order(date desc){
  "slug": slug.current,
  title,
  excerpt,
  category,
  date,
  readTime,
  "image": image.asset->url,
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
  body
}`;

// Sync helpers for the initial render: when Sanity is disabled we resolve
// from the static fallback immediately, preserving today's no-flash UX.
// When Sanity is enabled, the initial render returns the "still loading"
// shape and the async fetch fills in.

export function getInitialPosts(): Post[] | null {
  return sanityClient ? null : fallbackPosts;
}

export function getInitialPost(slug: string): Post | null | undefined {
  if (sanityClient) return undefined;
  return fallbackPosts.find((p) => p.slug === slug) ?? null;
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
  if (!sanityClient) return fallbackPosts;
  try {
    return await sanityClient.fetch<Post[]>(POSTS_QUERY);
  } catch {
    return fallbackPosts;
  }
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!sanityClient) {
    return fallbackPosts.find((p) => p.slug === slug) ?? null;
  }
  try {
    return await sanityClient.fetch<Post | null>(POST_QUERY, { slug });
  } catch {
    return fallbackPosts.find((p) => p.slug === slug) ?? null;
  }
}
