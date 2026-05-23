/**
 * Canonical service packages — the single source of truth for the slugs that
 * link a clicked Services card to the inquiry form's "Interested Service" field
 * (issue #95). Both Services.tsx (to build the CTA link) and Inquiry.tsx (to
 * read the URL param and render the dropdown) import from here, so slugs and
 * labels never drift apart.
 *
 * Labels MUST match the card titles in src/components/Services.tsx exactly,
 * since Services maps a card to its slug by label.
 */

export type ServiceOption = { slug: string; label: string };

export const SERVICE_OPTIONS: ServiceOption[] = [
  { slug: "in-your-corner", label: "In Your Corner" },
  { slug: "getting-it-together", label: "Getting It Together" },
  { slug: "the-full-femme", label: "The Full Femme" },
];

// Neutral fallback for visitors who reach the form without picking a package.
export const NOT_SURE_LABEL = "Not sure yet";

/** Maps a card label to its CTA link, e.g. `/?service=the-full-femme#inquiry`. */
export function inquiryHrefForLabel(label: string): string {
  const slug = SERVICE_OPTIONS.find((o) => o.label === label)?.slug;
  return slug ? `/?service=${slug}#inquiry` : "#inquiry";
}

/** Resolves a URL `?service=<slug>` value back to its display label, or "". */
export function labelForSlug(slug: string | null): string {
  if (!slug) return "";
  return SERVICE_OPTIONS.find((o) => o.slug === slug)?.label ?? "";
}
