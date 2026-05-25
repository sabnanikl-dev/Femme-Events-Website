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

const html = read("index.html");
for (const snippet of [
  'rel="canonical" href="https://femmeevents.com/"',
  'property="og:image" content="https://femmeevents.com/og-image.png"',
  'property="og:image:width" content="1200"',
  'property="og:image:height" content="630"',
  'name="twitter:image" content="https://femmeevents.com/og-image.png"',
]) {
  if (!html.includes(snippet)) fail(`index.html is missing ${snippet}`);
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
const types = Array.isArray(jsonLd["@type"]) ? jsonLd["@type"] : [jsonLd["@type"]];
if (types.includes("FAQPage") || types.includes("BreadcrumbList")) fail("FAQ/Breadcrumb schema should stay deferred until matching visible schema scope is approved");

console.log("SEO static asset verification passed.");
