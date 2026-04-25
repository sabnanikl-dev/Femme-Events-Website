import { sanityClient } from "./sanity";
import { posts as fallbackPosts, type Post } from "../data/posts";

export type { Post };

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
