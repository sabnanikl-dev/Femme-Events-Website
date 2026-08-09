/**
 * Generates public/og-image.png — the 1200x630 social link-preview graphic.
 *
 * The wordmark is NOT retyped. It is read at build time from the approved brand
 * source `public/logo-nav.svg` (the same asset used by the site navbar, the
 * favicon, and the JSON-LD `logo` property) and nested as vector paths, so the
 * preview always matches the shipped logo exactly.
 *
 * Supporting type uses Frunchy Sage (the site's `--font-display`, used for the
 * homepage H1) and the approved palette from src/index.css.
 *
 * NOTE: public/fonts/balgin-display-regular.otf and the-seasons-regular.ttf are
 * Fontspring DEMO builds whose `&` and `@` glyphs are replaced by a "DEMO"
 * watermark ornament. They are deliberately NOT used here so the preview can
 * never bake a watermark into a shared image. Frunchy Sage carries no such
 * markers and renders the full character set correctly.
 *
 * Usage: npm run og:image
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const p = (rel) => fileURLToPath(new URL(rel, root));

// ---------------------------------------------------------------------------
// Approved palette (verbatim from src/index.css @theme block)
// ---------------------------------------------------------------------------
const CREAM = "#f7edf0"; // --color-femme-cream
const PALE = "#f0dbe1"; // --color-femme-pale
const LAVENDER = "#e1b7c4"; // --color-femme-lavender
const PLUM = "#831654"; // --color-femme-plum
const ACCENT = "#e151a3"; // --color-femme-orange (dark-raspberry-400)

const escapeXml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------------------
// Extract the approved wordmark from public/logo-nav.svg
// ---------------------------------------------------------------------------
const logoSvg = readFileSync(p("public/logo-nav.svg"), "utf8");

const viewBoxMatch = logoSvg.match(/viewBox="([^"]+)"/);
if (!viewBoxMatch) throw new Error("logo-nav.svg is missing a viewBox");
const logoViewBox = viewBoxMatch[1];

// Inner markup only — drop the outer <svg> wrapper so we can re-nest it with
// our own placement while preserving the original coordinate system.
const openEnd = logoSvg.indexOf(">") + 1;
const closeStart = logoSvg.lastIndexOf("</svg>");
if (openEnd <= 0 || closeStart < 0) throw new Error("Could not parse logo-nav.svg");
const logoInner = logoSvg.slice(openEnd, closeStart).trim();

const [, , vbW, vbH] = logoViewBox.split(/[\s,]+/).map(Number);
const logoAspect = vbW / vbH;

// ---------------------------------------------------------------------------
// Composition (1200x630). All content sits inside a central safe area so that
// square/center-cropping unfurl surfaces never clip the branding.
// ---------------------------------------------------------------------------
const W = 1200;
const H = 630;

const LOGO_W = 600;
const LOGO_H = Math.round((LOGO_W / logoAspect) * 100) / 100;
const LOGO_X = (W - LOGO_W) / 2;
const LOGO_Y = 186;

const RULE_Y = LOGO_Y + LOGO_H + 62;
const TAGLINE_Y = RULE_Y + 62;

// Grounded in the approved og:description already shipped in index.html
// ("Atlanta wedding coordination and design studio"). No new claims.
// Plain text; uppercased then XML-escaped at the point of use, so the literal
// stays readable and an "&" can never leak into the markup unescaped.
const TAGLINE = "Atlanta Wedding Coordination & Design";
const TAGLINE_TRACKING = 6;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PALE}"/>
      <stop offset="0.30" stop-color="${CREAM}"/>
      <stop offset="0.62" stop-color="${CREAM}"/>
      <stop offset="1" stop-color="${LAVENDER}"/>
    </linearGradient>

    <!-- Soft pink bloom echoing the approved logo-footer.svg treatment. Kept
         light and seated below the wordmark so the logo stays high-contrast. -->
    <radialGradient id="bloom" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.22"/>
      <stop offset="0.45" stop-color="${ACCENT}" stop-opacity="0.11"/>
      <stop offset="0.75" stop-color="${ACCENT}" stop-opacity="0.03"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <ellipse cx="${W / 2}" cy="${H * 0.72}" rx="${W * 0.40}" ry="${H * 0.46}" fill="url(#bloom)"/>

  <!-- Hairline frame so the card reads as a defined tile on white chat backgrounds -->
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="18" ry="18"
        fill="none" stroke="${PLUM}" stroke-opacity="0.32" stroke-width="2"/>

  <!-- Approved wordmark, vector paths sourced from public/logo-nav.svg -->
  <svg x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_W}" height="${LOGO_H}"
       viewBox="${logoViewBox}" preserveAspectRatio="xMidYMid meet">
    ${logoInner}
  </svg>

  <line x1="${W / 2 - 74}" y1="${RULE_Y}" x2="${W / 2 + 74}" y2="${RULE_Y}"
        stroke="${ACCENT}" stroke-width="3" stroke-linecap="round"/>

  <!-- Letter-spacing is applied per-glyph, leaving trailing space after the final
       character, so shift left by half of it to keep the line optically centred.
       Frunchy Sage ships a single light weight; a hairline stroke in the same ink
       adds just enough optical weight to survive downscaling to ~200px. -->
  <text x="${W / 2 - TAGLINE_TRACKING / 2}" y="${TAGLINE_Y}" text-anchor="middle"
        font-family="Frunchy Sage" font-size="41" letter-spacing="${TAGLINE_TRACKING}"
        fill="${PLUM}" stroke="${PLUM}" stroke-width="0.7"
        paint-order="stroke">${escapeXml(TAGLINE.toUpperCase())}</text>
</svg>`;

// ---------------------------------------------------------------------------
// Rasterize
// ---------------------------------------------------------------------------
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: {
    loadSystemFonts: false,
    fontFiles: [p("public/fonts/frunchy-sage.ttf")],
    defaultFontFamily: "Frunchy Sage",
  },
});

const png = resvg.render().asPng();
writeFileSync(p("public/og-image.png"), png);

// Assert the exact contract the SEO validator and OG metadata depend on:
// a real PNG (correct magic bytes, so the CDN serves image/png) at 1200x630.
const PNG_SIGNATURE = "89504e470d0a1a0a";
if (png.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) {
  throw new Error("Generated file is not a valid PNG");
}
const width = png.readUInt32BE(16); // IHDR width
const height = png.readUInt32BE(20); // IHDR height
if (width !== W || height !== H) {
  throw new Error(`Expected ${W}x${H}, generated ${width}x${height}`);
}

console.log(`Wrote public/og-image.png (${width}x${height}, ${png.length} bytes)`);
