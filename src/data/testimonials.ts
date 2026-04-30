export interface Testimonial {
  quote: string;
  name: string;
  detail: string;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "Amanda made our day feel effortless. Every tiny detail we obsessed over for months just appeared — perfectly. We didn't lift a finger and somehow it was better than anything we'd imagined.",
    name: "Priscila & Tri",
    detail: "Atlanta, GA · Full Coordination + Design",
  },
  {
    quote:
      "Hiring Femme Events for day-of coordination was the best decision we made. Amanda kept everything moving without us ever feeling the pressure. Our guests still talk about how smooth it all was.",
    name: "Kaitlyn & James",
    detail: "Roswell, GA · Day-of Coordination",
  },
  {
    quote:
      "We were DIY-ing everything and totally overwhelmed. The partial planning package was exactly what we needed — vendor recommendations, mood boards, budget help. She got us across the finish line with our sanity intact.",
    name: "Maya & Devon",
    detail: "Decatur, GA · Partial Planning",
  },
];
