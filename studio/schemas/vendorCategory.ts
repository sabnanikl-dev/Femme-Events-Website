import { defineField, defineType } from "sanity";

export const vendorCategory = defineType({
  name: "vendorCategory",
  title: "Vendor Category",
  type: "document",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      description: 'e.g. "Venues", "Florists", "Photographers".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "order",
      title: "Display Order",
      type: "number",
      description: "Lower numbers appear first. Leave blank to sort alphabetically.",
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "order" },
    prepare({ title, subtitle }) {
      return {
        title,
        subtitle: subtitle != null ? `Order: ${subtitle}` : "No order set",
      };
    },
  },
});
