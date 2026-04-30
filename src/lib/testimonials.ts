import { sanityClient } from "./sanity";
import { testimonials as fallbackTestimonials, type Testimonial } from "../data/testimonials";

export type { Testimonial };

// Sort: explicit `order` ascending first (with nulls last), then newest
// _createdAt as a tiebreaker so items without an order still feel fresh.
const TESTIMONIALS_QUERY = `*[_type == "testimonial"] | order(coalesce(order, 99999) asc, _createdAt desc){
  "name": name,
  "quote": quote,
  "detail": detail
}`;

export function getInitialTestimonials(): Testimonial[] | null {
  return sanityClient ? null : fallbackTestimonials;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  if (!sanityClient) return fallbackTestimonials;
  try {
    const result = await sanityClient.fetch<Testimonial[]>(TESTIMONIALS_QUERY);
    // Empty CMS = use fallback so the section never renders blank.
    return result.length > 0 ? result : fallbackTestimonials;
  } catch {
    return fallbackTestimonials;
  }
}
