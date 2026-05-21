import type { Vendor, VendorCategory } from "../data/vendors";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function mergeVendors(cmsVendors: Vendor[], fallbackVendors: Vendor[]): Vendor[] {
  const cmsNames = new Set(cmsVendors.map((vendor) => normalizeKey(vendor.name)));
  return [
    ...cmsVendors,
    ...fallbackVendors.filter((vendor) => !cmsNames.has(normalizeKey(vendor.name))),
  ];
}

export function getMergedVendorCategories(
  cmsCategories: VendorCategory[],
  fallback: VendorCategory[],
): VendorCategory[] {
  const populatedCmsCategories = cmsCategories.filter((category) => category.vendors.length > 0);
  if (populatedCmsCategories.length === 0) return fallback;

  const fallbackByLabel = new Map(
    fallback.map((category) => [normalizeKey(category.label), category]),
  );
  const cmsLabels = new Set(populatedCmsCategories.map((category) => normalizeKey(category.label)));

  const mergedCmsCategories = populatedCmsCategories.map((category) => {
    const fallbackCategory = fallbackByLabel.get(normalizeKey(category.label));
    return fallbackCategory
      ? { ...category, vendors: mergeVendors(category.vendors, fallbackCategory.vendors) }
      : category;
  });

  const missingFallbackCategories = fallback.filter(
    (category) => !cmsLabels.has(normalizeKey(category.label)),
  );

  return [...mergedCmsCategories, ...missingFallbackCategories];
}
