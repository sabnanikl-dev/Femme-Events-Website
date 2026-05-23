// Sanity image URL helpers. These only modify Sanity CDN URLs;
// non-Sanity URLs (e.g. the `/photos/*.jpg` static fallbacks) are
// passed through untouched so callers can safely use these helpers
// against either source.

const SANITY_HOST = "cdn.sanity.io";

interface SanityImageOpts {
  w?: number;
  q?: number;
  fit?: "max" | "crop";
}

interface SanityHotspot {
  x?: number;
  y?: number;
}

export function isSanityUrl(url: string | undefined): url is string {
  return typeof url === "string" && url.includes(SANITY_HOST);
}

// Returns a Sanity CDN URL with width / format / quality params applied.
// Non-Sanity URLs are returned unchanged.
export function sanityImageUrl(url: string, opts: SanityImageOpts = {}): string {
  if (!isSanityUrl(url)) return url;
  const params = new URLSearchParams();
  if (opts.w) params.set("w", String(opts.w));
  params.set("q", String(opts.q ?? 80));
  params.set("fit", opts.fit ?? "max");
  // auto=format lets Sanity negotiate WebP / AVIF based on the browser's
  // Accept header — modern browsers get the modern format, older clients
  // still get JPEG.
  params.set("auto", "format");
  return `${url}?${params.toString()}`;
}

// Builds a `srcSet` string covering the given widths. Returns undefined
// for non-Sanity URLs so callers can omit the attribute entirely
// (otherwise the browser would use a single static URL repeated at
// every density, which serves no purpose).
export function buildSrcSet(
  url: string,
  widths: number[],
  opts: Omit<SanityImageOpts, "w"> = {},
): string | undefined {
  if (!isSanityUrl(url)) return undefined;
  return widths
    .map((w) => `${sanityImageUrl(url, { ...opts, w })} ${w}w`)
    .join(", ");
}

// Sanity asset URLs encode original dimensions in the path:
//   .../<projectId>/<dataset>/<assetId>-1600x1067.jpg
// Parsing them lets us set explicit width / height attributes on the
// img tag, which helps the browser reserve layout space before bytes
// arrive (CLS defense).
export function parseSanityDimensions(
  url: string | undefined,
): { width: number; height: number } | null {
  if (!isSanityUrl(url)) return null;
  const match = /-(\d+)x(\d+)\.[a-zA-Z0-9]+(?:\?|$)/.exec(url);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function imageObjectPosition(
  fallbackPosition?: string,
  hotspot?: SanityHotspot,
): string | undefined {
  if (hotspot?.x !== undefined && hotspot?.y !== undefined) {
    const x = Math.min(100, Math.max(0, hotspot.x * 100));
    const y = Math.min(100, Math.max(0, hotspot.y * 100));
    return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
  }
  return fallbackPosition;
}
