import { defineField, defineType } from "sanity";

export const testimonial = defineType({
  name: "testimonial",
  title: "Testimonial",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Couple / Client Name",
      type: "string",
      description: 'e.g. "Priscila & Tri" — the ampersand renders in the system font.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "quote",
      title: "Quote",
      type: "text",
      rows: 5,
      validation: (Rule) => Rule.required().max(600),
    }),
    defineField({
      name: "detail",
      title: "Detail Line",
      type: "string",
      description: 'Location + service, e.g. "Atlanta, GA · Full Coordination + Design".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "eventDate",
      title: "Event Date",
      type: "date",
      description: "Optional — date of the wedding/event.",
    }),
    defineField({
      name: "order",
      title: "Display Order",
      type: "number",
      description: "Lower numbers appear first. Leave blank to sort newest first.",
    }),
    defineField({
      name: "image",
      title: "Photo",
      type: "image",
      options: { hotspot: true },
      description: "Optional — not yet rendered on the site, reserved for a future design pass.",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "detail", media: "image" },
  },
});
