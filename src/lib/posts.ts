import type { PortableTextBlock } from "@portabletext/react";
import { sanityClient } from "./sanity";

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  imagePosition?: string;
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

// Sync helpers for the initial render:
// - Sanity enabled  → return the "still loading" shape (null / undefined);
//   the async fetch fills in the real result.
// - Sanity disabled → resolve to empty content; CMS-backed pages do not use
//   static fallback content.

export function getInitialPosts(): Post[] | null {
  return sanityClient ? null : [];
}

export function getInitialPost(slug: string): Post | null | undefined {
  if (sanityClient) return undefined;
  return null;
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
  if (!sanityClient) return [];
  try {
    return await sanityClient.fetch<Post[]>(POSTS_QUERY);
  } catch {
    return [];
  }
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!sanityClient) return null;
  try {
    return await sanityClient.fetch<Post | null>(POST_QUERY, { slug });
  } catch {
    return null;
  }
}
