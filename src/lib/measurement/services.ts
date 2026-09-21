/**
 * Display label to canonical package slug.
 *
 * The allowlist only accepts canonical slugs, so every callsite that knows a
 * package by its card title converts here first. `src/data/serviceOptions.ts`
 * stays the single source of truth for the slug/label pairs.
 */

import { SERVICE_OPTIONS } from "../../data/serviceOptions.ts";
import { NOT_SURE_SLUG } from "./schema.ts";

/** @returns the canonical slug, or `not-sure` for anything unrecognised. */
export function slugForLabel(label: string): string {
  return SERVICE_OPTIONS.find((option) => option.label === label)?.slug ?? NOT_SURE_SLUG;
}
