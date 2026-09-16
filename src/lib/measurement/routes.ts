/**
 * Controlled route labels. The provider receives one of a fixed set of category
 * strings — never a raw pathname, CMS slug, query string or fragment.
 */

export const ROUTE_LABELS = ["/", "/about", "/what-happens-next", "/journal", "/journal/post", "/other"] as const;

export type RouteLabel = (typeof ROUTE_LABELS)[number];

/** Maps a real pathname to its safe category. Anything unknown is `/other`. */
export function routeLabelFor(pathname: string): RouteLabel {
  if (typeof pathname !== "string" || pathname === "") return "/other";
  // Collapse a trailing slash so `/about/` and `/about` label identically.
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  switch (normalised) {
    case "":
    case "/":
      return "/";
    case "/about":
      return "/about";
    case "/what-happens-next":
      return "/what-happens-next";
    case "/journal":
      return "/journal";
    default:
      break;
  }
  // Exactly one further segment under /journal is a journal detail route. The
  // slug itself is deliberately discarded.
  if (/^\/journal\/[^/]+$/.test(normalised)) return "/journal/post";
  return "/other";
}
