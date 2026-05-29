import { sanityClient } from "./sanity";
import type { Testimonial } from "../data/testimonials";

export type { Testimonial };

// Sort: explicit `order` ascending first (with nulls last), then newest
// _createdAt as a tiebreaker so items without an order still feel fresh.
const TESTIMONIALS_QUERY = `*[_type == "testimonial"] | order(coalesce(order, 99999) asc, _createdAt desc){
  "name": name,
  "quote": quote,
  "detail": detail
}`;

export function getInitialTestimonials(): Testimonial[] | null {
  return sanityClient ? null : [];
}

export async function getTestimonials(): Promise<Testimonial[]> {
  if (!sanityClient) return [];
  try {
    return await sanityClient.fetch<Testimonial[]>(TESTIMONIALS_QUERY);
  } catch {
    return [];
  }
}
