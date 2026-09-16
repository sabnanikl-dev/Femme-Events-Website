import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const fail = (message) => {
  console.error(`SEO verification failed: ${message}`);
  process.exit(1);
};

const robots = read("public/robots.txt");
if (!robots.includes("User-agent: *")) fail("robots.txt is missing User-agent: *");
if (!robots.includes("Allow: /")) fail("robots.txt must allow public crawl");
if (!robots.includes("Sitemap: https://femmeevents.com/sitemap.xml")) fail("robots.txt is missing the canonical sitemap URL");

const sitemap = read("public/sitemap.xml");
const requiredUrls = [
  "https://femmeevents.com/",
];
for (const url of requiredUrls) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap.xml is missing ${url}`);
}
const deferredUrls = [
  "https://femmeevents.com/about",
  "https://femmeevents.com/what-happens-next",
  "https://femmeevents.com/journal",
];
for (const url of deferredUrls) {
  if (sitemap.includes(`<loc>${url}</loc>`)) {
    fail(`sitemap.xml should not include ${url} until it has route-specific canonical metadata`);
  }
}
if (sitemap.includes("#")) fail("sitemap.xml should not include fragment-only homepage sections");

const ogImagePath = "public/og-image.png";
const og = statSync(new URL(ogImagePath, root));
if (og.size < 10_000) fail("og-image.png exists but is unexpectedly small");
if (extname(ogImagePath) !== ".png") fail("OG image should be PNG");
const ogImage = readFileSync(new URL(ogImagePath, root));
const pngSignature = "89504e470d0a1a0a";
if (ogImage.subarray(0, 8).toString("hex") !== pngSignature) fail("og-image.png must be a valid PNG file");
const ogWidth = ogImage.readUInt32BE(16);
const ogHeight = ogImage.readUInt32BE(20);
if (ogWidth !== 1200 || ogHeight !== 630) {
  fail(`og-image.png must be 1200x630, got ${ogWidth}x${ogHeight}`);
}

// ---------------------------------------------------------------------------
// Brand icon set (issue #150). These are generated from the approved
// public/logo-footer.svg by `npm run icons`.
// ---------------------------------------------------------------------------
const readBinary = (path, label) => {
  try {
    return readFileSync(new URL(path, root));
  } catch {
    return fail(`${label} is missing — run \`npm run icons\``);
  }
};

/** Reads IHDR width/height, asserting the buffer really is a PNG. */
const pngDimensions = (buffer, label) => {
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) fail(`${label} must be a valid PNG file`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

const readSquarePng = (path, expectedSize) => {
  const { width, height } = pngDimensions(readBinary(path, path), path);
  if (width !== height) fail(`${path} must be square, got ${width}x${height}`);
  if (width !== expectedSize) fail(`${path} must be ${expectedSize}x${expectedSize}, got ${width}x${height}`);
};

const iconPngs = [
  ["public/favicon-16x16.png", 16],
  ["public/favicon-32x32.png", 32],
  ["public/favicon-48x48.png", 48],
  ["public/apple-touch-icon.png", 180],
  ["public/android-chrome-192x192.png", 192],
  ["public/android-chrome-512x512.png", 512],
];
for (const [path, size] of iconPngs) readSquarePng(path, size);

// favicon.ico must be a real multi-frame icon container, not an HTML fallback
// or a renamed PNG. Frames are PNG-compressed (written by scripts/generate-icons.mjs).
const ico = readBinary("public/favicon.ico", "public/favicon.ico");
if (ico.length < 22 || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
  fail("public/favicon.ico is not a valid ICO container (bad ICONDIR header)");
}
const icoFrameCount = ico.readUInt16LE(4);
if (icoFrameCount < 3) fail(`favicon.ico must carry multiple frames, found ${icoFrameCount}`);
const icoFrameSizes = [];
for (let i = 0; i < icoFrameCount; i += 1) {
  const entry = 6 + i * 16;
  if (entry + 16 > ico.length) fail("favicon.ico directory is truncated");
  const declared = ico.readUInt8(entry) || 256;
  const byteLength = ico.readUInt32LE(entry + 8);
  const byteOffset = ico.readUInt32LE(entry + 12);
  if (byteLength <= 0 || byteOffset + byteLength > ico.length) {
    fail(`favicon.ico frame ${declared} points outside the file`);
  }
  const frame = ico.subarray(byteOffset, byteOffset + byteLength);
  const { width: frameWidth, height: frameHeight } = pngDimensions(
    frame,
    `favicon.ico frame ${declared} (expected a PNG-compressed frame)`,
  );
  if (frameWidth !== declared || frameHeight !== declared) {
    fail(`favicon.ico frame declares ${declared}px but contains ${frameWidth}x${frameHeight}`);
  }
  icoFrameSizes.push(declared);
}
for (const required of [16, 32, 48]) {
  if (!icoFrameSizes.includes(required)) {
    fail(`favicon.ico is missing the ${required}px frame (have: ${icoFrameSizes.join(", ")})`);
  }
}

let manifest;
try {
  manifest = JSON.parse(read("public/site.webmanifest"));
} catch (error) {
  fail(`public/site.webmanifest is missing or invalid JSON: ${error.message}`);
}
const manifestSizes = (manifest.icons ?? []).map((icon) => icon.sizes);
for (const required of ["192x192", "512x512"]) {
  if (!manifestSizes.includes(required)) fail(`site.webmanifest is missing a ${required} icon`);
}
for (const icon of manifest.icons ?? []) {
  if (icon.type !== "image/png") fail(`site.webmanifest icon ${icon.src} must be image/png`);
  if (!icon.src?.startsWith("/")) fail(`site.webmanifest icon ${icon.src} must use a root-relative src`);
  readBinary(`public${icon.src}`, `site.webmanifest icon ${icon.src}`);
}

const html = read("index.html");
for (const snippet of [
  'rel="canonical" href="https://femmeevents.com/"',
  'property="og:image" content="https://femmeevents.com/og-image.png"',
  'property="og:image:width" content="1200"',
  'property="og:image:height" content="630"',
  'name="twitter:image" content="https://femmeevents.com/og-image.png"',
  'rel="icon" href="/favicon.ico" sizes="any"',
  'rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"',
  'rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"',
  'rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png"',
  'rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"',
  'rel="manifest" href="/site.webmanifest"',
]) {
  if (!html.includes(snippet)) fail(`index.html is missing ${snippet}`);
}
// An SVG icon outranks every raster <link rel="icon"> in browsers and muddies
// which asset a crawler treats as the site icon, so the icon set must stay raster-only.
if (/<link[^>]*rel="icon"[^>]*image\/svg\+xml/.test(html)) {
  fail("index.html declares a competing SVG favicon; the icon set must resolve to /favicon.ico and the PNG set");
}
if (html.includes("+167****5257")) fail("schema still contains a masked phone number");

const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!jsonLdMatch) fail("index.html is missing JSON-LD");
let jsonLd;
try {
  jsonLd = JSON.parse(jsonLdMatch[1]);
} catch (error) {
  fail(`JSON-LD is invalid JSON: ${error.message}`);
}

if (jsonLd["@id"] !== "https://femmeevents.com/#organization") fail("JSON-LD is missing the stable organization @id");
if (jsonLd.url !== "https://femmeevents.com/") fail("JSON-LD url must be canonical with trailing slash");
if (!/^\+1\d{10}$/.test(jsonLd.telephone)) fail("JSON-LD telephone must be an E.164 public phone number");
if (!Array.isArray(jsonLd.sameAs) || !jsonLd.sameAs.includes("https://www.instagram.com/_femmeevents/")) {
  fail("JSON-LD sameAs must include the public Instagram URL");
}
// Dedicated square logo for search/knowledge-panel use. Must be an absolute
// canonical https URL backed by a real square PNG in public/.
const expectedLogo = "https://femmeevents.com/android-chrome-512x512.png";
if (jsonLd.logo !== expectedLogo) {
  fail(`JSON-LD logo must be ${expectedLogo}, got ${jsonLd.logo ?? "(missing)"}`);
}
const logoPath = `public${jsonLd.logo.replace("https://femmeevents.com", "")}`;
const { width: logoWidth, height: logoHeight } = pngDimensions(
  readBinary(logoPath, `JSON-LD logo asset ${logoPath}`),
  logoPath,
);
if (logoWidth !== logoHeight) fail(`${logoPath} must be square, got ${logoWidth}x${logoHeight}`);
if (logoWidth < 112) fail(`${logoPath} must be at least 112x112 for structured-data logo use, got ${logoWidth}px`);

const types = Array.isArray(jsonLd["@type"]) ? jsonLd["@type"] : [jsonLd["@type"]];
if (types.includes("FAQPage") || types.includes("BreadcrumbList")) fail("FAQ/Breadcrumb schema should stay deferred until matching visible schema scope is approved");

console.log("SEO static asset verification passed.");
