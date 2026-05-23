export interface Testimonial {
  quote: string;
  name: string;
  detail: string;
}

// Intentionally empty until real client testimonials are collected. Testimonials
// are managed in Sanity (the "Testimonial" document type) so Amanda can add them
// self-serve. While both this list and the CMS are empty, the Testimonials
// section hides itself (see src/components/Testimonials.tsx) rather than showing
// placeholder reviews. Adding entries in Sanity makes the section reappear
// automatically — no code change or redeploy required.
export const testimonials: Testimonial[] = [];
