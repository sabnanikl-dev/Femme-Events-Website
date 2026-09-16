/**
 * Generates the Femme Events favicon / app-icon set under public/.
 *
 * SOURCE OF TRUTH: public/logo-footer.svg — the approved footer logo (the
 * "FEMME" wordmark in brand brown over the soft pink bloom). The wordmark is
 * NOT retyped or recreated: this script nests the original vector/mask markup
 * unchanged and only reframes it, so every icon is literally the approved
 * artwork.
 *
 * WHY A CROP IS NEEDED: logo-footer.svg ships a 252x144 viewBox, but its drawn
 * content occupies exactly 126x126 units (x 63..189, y 9..135) — the artwork is
 * already square, surrounded by empty padding. This script measures that
 * content box at build time (Resvg#getBBox), squares it up defensively, and
 * uses it as the icon frame. No artwork is added, moved, or removed.
 *
 * CANVAS: icons are flattened onto --color-femme-cream (#f7edf0) from the
 * approved palette in src/index.css. The source SVG has a transparent
 * background; an opaque canvas is required because iOS composites
 * apple-touch-icon over black, and a transparent favicon would drop the dark
 * brown wordmark into invisibility on dark browser chrome.
 *
 * LEGIBILITY LIMIT (documented, not worked around): the wordmark is five
 * letters spanning ~78% of the square. At 16x16 that is ~2.5 device pixels per
 * letter, so the individual letterforms physically cannot resolve — the 16px
 * frame reads as the brand's pink bloom with a dark wordmark bar. That is a
 * raster limit, not a generation bug. The larger frames (48px+, which is what
 * Google's favicon crawler and the SERP logo slot actually use) do resolve the
 * wordmark. We deliberately do not substitute a different, invented mark.
 *
 * Deps: only @resvg/resvg-js (already used by scripts/generate-og-image.mjs).
 * The .ico container is assembled here from plain buffers — no icon library.
 *
 * Usage: npm run icons
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const p = (rel) => fileURLToPath(new URL(rel, root));

// --color-femme-cream from src/index.css (approved palette, verbatim).
const CREAM = "#f7edf0";

const SOURCE = "public/logo-footer.svg";

const PNG_SIGNATURE = "89504e470d0a1a0a";

/** Standalone PNG icons written to public/. */
const PNG_TARGETS = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "favicon-48x48.png", size: 48 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "android-chrome-192x192.png", size: 192 },
  { file: "android-chrome-512x512.png", size: 512 },
];

/**
 * Frames packed into favicon.ico. 16/32 are the classic tab sizes; 48 is the
 * size Google documents for the search-result favicon; 64/128 keep the file
 * crisp on HiDPI tabs and Windows shortcuts.
 */
const ICO_FRAMES = [16, 32, 48, 64, 128];

// ---------------------------------------------------------------------------
// Read the approved source and reduce it to its inner markup
// ---------------------------------------------------------------------------
const logoSvg = readFileSync(p(SOURCE), "utf8");

const openEnd = logoSvg.indexOf(">") + 1;
const closeStart = logoSvg.lastIndexOf("</svg>");
if (openEnd <= 0 || closeStart < 0) throw new Error(`Could not parse ${SOURCE}`);
const logoInner = logoSvg.slice(openEnd, closeStart).trim();
if (!logoInner) throw new Error(`${SOURCE} has no drawable content`);

// ---------------------------------------------------------------------------
// Measure the drawn content and derive the square icon frame
// ---------------------------------------------------------------------------
const bbox = new Resvg(logoSvg).getBBox();
if (!bbox || !Number.isFinite(bbox.width) || bbox.width <= 0 || bbox.height <= 0) {
  throw new Error(`Could not measure the content bounding box of ${SOURCE}`);
}

const aspect = bbox.width / bbox.height;
if (aspect < 0.95 || aspect > 1.05) {
  // Guard rail: if the approved artwork is ever replaced with something
  // strongly non-square, squaring it silently would change the composition.
  // Fail loudly instead so a human re-approves the crop treatment.
  throw new Error(
    `${SOURCE} content box is ${bbox.width.toFixed(2)}x${bbox.height.toFixed(2)} ` +
      `(aspect ${aspect.toFixed(3)}); expected a square-safe mark. Re-approve the crop before regenerating.`,
  );
}

// Square the content box around its own centre (a no-op when it is already
// square, which the current approved asset is).
const side = Math.max(bbox.width, bbox.height);
const frameX = bbox.x + bbox.width / 2 - side / 2;
const frameY = bbox.y + bbox.height / 2 - side / 2;
const round2 = (n) => Math.round(n * 100) / 100;
const viewBox = `${round2(frameX)} ${round2(frameY)} ${round2(side)} ${round2(side)}`;

/** Renders the approved artwork, reframed to its square content box. */
const renderSquare = (size) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${size}" height="${size}" viewBox="${viewBox}">${logoInner}</svg>`;

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: CREAM,
  })
    .render()
    .asPng();

  // Assert the contract the browser, the CDN MIME sniffing, and
  // scripts/verify-seo-assets.mjs all depend on.
  if (png.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) {
    throw new Error(`Rendered ${size}px frame is not a valid PNG`);
  }
  const width = png.readUInt32BE(16); // IHDR width
  const height = png.readUInt32BE(20); // IHDR height
  if (width !== size || height !== size) {
    throw new Error(`Expected ${size}x${size}, rendered ${width}x${height}`);
  }
  return png;
};

// ---------------------------------------------------------------------------
// Minimal ICO container (ICONDIR + ICONDIRENTRY[] + PNG-compressed frames)
// ---------------------------------------------------------------------------
const buildIco = (frames) => {
  const HEADER = 6;
  const ENTRY = 16;
  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(frames.length, 4);

  let offset = HEADER + ENTRY * frames.length;
  const entries = frames.map(({ size, png }) => {
    const entry = Buffer.alloc(ENTRY);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette colours (0 = truecolour)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...frames.map((f) => f.png)]);
};

// ---------------------------------------------------------------------------
// Write everything
// ---------------------------------------------------------------------------
console.log(`Source: ${SOURCE}`);
console.log(
  `Content box: ${round2(bbox.x)},${round2(bbox.y)} ${round2(bbox.width)}x${round2(bbox.height)} → icon viewBox "${viewBox}"`,
);

for (const { file, size } of PNG_TARGETS) {
  const png = renderSquare(size);
  writeFileSync(p(`public/${file}`), png);
  console.log(`Wrote public/${file} (${size}x${size}, ${png.length} bytes)`);
}

const icoFrames = ICO_FRAMES.map((size) => ({ size, png: renderSquare(size) }));
const ico = buildIco(icoFrames);
writeFileSync(p("public/favicon.ico"), ico);
console.log(
  `Wrote public/favicon.ico (${ico.length} bytes, frames: ${ICO_FRAMES.join(", ")})`,
);
