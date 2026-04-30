import { defineField, defineType } from "sanity";

export const vendor = defineType({
  name: "vendor",
  title: "Vendor",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Vendor Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "specialty",
      title: "Specialty",
      type: "string",
      description: 'Short tagline, e.g. "Organic garden-style arrangements".',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "reference",
      to: [{ type: "vendorCategory" }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "websiteUrl",
      title: "Website URL",
      type: "url",
      description: "Optional — full URL including https://.",
    }),
    defineField({
      name: "instagramHandle",
      title: "Instagram Handle",
      type: "string",
      description: 'Optional — username only, with or without the leading "@".',
    }),
    defineField({
      name: "published",
      title: "Visible on Site",
      type: "boolean",
      description: "Uncheck to hide from the website without deleting.",
      initialValue: true,
    }),
    defineField({
      name: "order",
      title: "Display Order",
      type: "number",
      description:
        "Order within the category. Lower numbers appear first; leave blank to sort alphabetically.",
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "category.label",
      published: "published",
    },
    prepare({ title, subtitle, published }) {
      const visibility = published === false ? " (hidden)" : "";
      return {
        title: `${title}${visibility}`,
        subtitle: subtitle ?? "Uncategorized",
      };
    },
  },
});
