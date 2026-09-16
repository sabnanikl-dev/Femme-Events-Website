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
 * uses it as the icon frame. Source artwork is unchanged; browser/search
 * output additionally receives the approved circular clip described below.
 *
 * CANVAS: the artwork always sits on --color-femme-cream (#f7edf0) from the
 * approved palette in src/index.css, because the source SVG is transparent and
 * the dark brown wordmark would vanish against dark browser chrome. The shape
 * of that canvas differs by audience:
 *
 *   - Browser / search icons (favicon-16x16, -32x32, -48x48 and every
 *     favicon.ico frame) get a cream DISC inscribed in the content square, with
 *     transparent corners, so the site icon reads as a round mark in tab strips
 *     and search results rather than a pale square. The artwork is clipped to
 *     that same circle, so the outer corners of the bloom fall outside it; the
 *     wordmark runs horizontally across the circle's widest axis and stays
 *     uncut. This treatment was reviewed and approved for issue #150.
 *   - App icons (apple-touch-icon, android-chrome-192/512) stay an OPAQUE
 *     CREAM SQUARE, unchanged. iOS composites apple-touch-icon over black and
 *     applies its own corner mask, and the 512px file is also the JSON-LD
 *     `logo`, which we deliberately keep as the approved opaque square.
 *
 * Either way the pixel dimensions stay square — only the painted region changes.
 *
 * LEGIBILITY LIMIT (documented, not worked around): the wordmark is five
 * letters spanning ~78% of the square. At 16x16 that is ~2.5 device pixels per
 * letter, so the individual letterforms physically cannot resolve — the 16px
 * frame reads as the brand's pink bloom with a dark wordmark bar. That is a
 * raster limit, not a generation bug. The larger frames do resolve the
 * wordmark, which is why this set ships 64 and 128px .ico frames: Google
 * recommends a square favicon larger than 48px and
 * then decides for itself what, if anything, it shows in a result. We
 * deliberately do not substitute a different, invented mark.
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

/**
 * Standalone PNG icons written to public/. `circular: true` marks the
 * browser/search icons that get the cream disc with transparent corners; the
 * app icons stay an opaque cream square.
 */
const PNG_TARGETS = [
  { file: "favicon-16x16.png", size: 16, circular: true },
  { file: "favicon-32x32.png", size: 32, circular: true },
  { file: "favicon-48x48.png", size: 48, circular: true },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "android-chrome-192x192.png", size: 192 },
  { file: "android-chrome-512x512.png", size: 512 },
];

/**
 * Frames packed into favicon.ico — all browser/search surfaces, so all
 * circular. 16/32 are classic tab sizes; 48 is another common raster size,
 * and 64/128 cover Google's recommended "larger than 48px"
 * guidance plus HiDPI tabs and Windows shortcuts.
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

// The disc inscribed in the content square: touches each edge at its midpoint,
// so it is the largest circle that keeps the frame's composition centred.
const discCx = round2(frameX + side / 2);
const discCy = round2(frameY + side / 2);
const discR = round2(side / 2);
// Namespaced so it cannot collide with an id inside the nested source markup.
const CLIP_ID = "femme-icon-disc-clip";

/**
 * Renders the approved artwork, reframed to its square content box.
 *
 * `circular` swaps the opaque cream background for a cream disc drawn inside
 * the SVG: the cream fill and the artwork share one clipPath, so there is a
 * single anti-aliased circle edge and everything outside it stays transparent.
 * Both variants render at `size` x `size` pixels.
 */
const renderSquare = (size, { circular = false } = {}) => {
  const open =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${size}" height="${size}" viewBox="${viewBox}">`;

  const svg = circular
    ? `${open}<defs><clipPath id="${CLIP_ID}">` +
      `<circle cx="${discCx}" cy="${discCy}" r="${discR}"/></clipPath></defs>` +
      `<g clip-path="url(#${CLIP_ID})">` +
      `<rect x="${round2(frameX)}" y="${round2(frameY)}" ` +
      `width="${round2(side)}" height="${round2(side)}" fill="${CREAM}"/>` +
      `${logoInner}</g></svg>`
    : `${open}${logoInner}</svg>`;

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    // Circular icons paint their own cream disc; an opaque canvas here would
    // fill the corners back in.
    ...(circular ? {} : { background: CREAM }),
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

for (const { file, size, circular = false } of PNG_TARGETS) {
  const png = renderSquare(size, { circular });
  writeFileSync(p(`public/${file}`), png);
  console.log(
    `Wrote public/${file} (${size}x${size}, ${circular ? "circular disc" : "opaque square"}, ${png.length} bytes)`,
  );
}

const icoFrames = ICO_FRAMES.map((size) => ({
  size,
  png: renderSquare(size, { circular: true }),
}));
const ico = buildIco(icoFrames);
writeFileSync(p("public/favicon.ico"), ico);
console.log(
  `Wrote public/favicon.ico (${ico.length} bytes, circular frames: ${ICO_FRAMES.join(", ")})`,
);
