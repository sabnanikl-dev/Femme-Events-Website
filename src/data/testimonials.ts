export interface Testimonial {
  quote: string;
  name: string;
  detail: string;
}

// Intentionally empty until real client testimonials are collected. Testimonials
// are managed in Sanity (the "Testimonial" document type) so Amanda can add them
// self-serve. The public site reads Sanity directly and hides the section when
// the CMS has no testimonials.
export const testimonials: Testimonial[] = [];
