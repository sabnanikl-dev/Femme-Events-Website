import { sanityClient } from "./sanity";
import {
  vendorCategories as fallbackCategories,
  type Vendor,
  type VendorCategory,
} from "../data/vendors";

export type { Vendor, VendorCategory };

// Fetch each category and inline only its published vendors. Categories
// with zero published vendors are filtered out client-side so the grid
// doesn't render empty headings.
const VENDORS_QUERY = `*[_type == "vendorCategory"] | order(coalesce(order, 99999) asc, label asc){
  "label": label,
  "vendors": *[_type == "vendor" && references(^._id) && published != false] | order(coalesce(order, 99999) asc, name asc){
    "name": name,
    "specialty": specialty,
    "url": websiteUrl,
    "instagram": instagramHandle,
    "image": image.asset->url
  }
}`;

export function getInitialVendorCategories(): VendorCategory[] | null {
  return sanityClient ? null : fallbackCategories;
}

export async function getVendorCategories(): Promise<VendorCategory[]> {
  if (!sanityClient) return fallbackCategories;
  try {
    const result = await sanityClient.fetch<VendorCategory[]>(VENDORS_QUERY);
    const populated = result.filter((c) => c.vendors.length > 0);
    return populated.length > 0 ? populated : fallbackCategories;
  } catch {
    return fallbackCategories;
  }
}

// Strips a leading "@" and any trailing slashes; returns null if the
// handle is empty after normalization. Defensive against Amanda pasting
// a full Instagram URL.
export function instagramUrl(handle: string | undefined): string | null {
  if (!handle) return null;
  const trimmed = handle.trim();
  if (!trimmed) return null;
  const username = trimmed
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return username ? `https://instagram.com/${username}` : null;
}
