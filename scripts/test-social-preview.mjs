// PUL-003: every route shares a social preview (1200x630 brand image,
// no ranking language) with per-route titles and canonical URLs.
// Run: node scripts/test-social-preview.mjs (static) and, with a server up,
//   BASE=http://localhost:3xxx node scripts/test-social-preview.mjs (live).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const img = fs.readFileSync(
  path.join(root, "app", "opengraph-image.tsx"),
  "utf8",
);
const layout = fs.readFileSync(path.join(root, "app", "layout.tsx"), "utf8");

// Generated 1200x630 via next/og: no binary asset to drift out of sync.
assert.ok(img.includes("1200") && img.includes("630"), "image must be 1200x630");
assert.ok(img.includes("ImageResponse"), "image must use next/og ImageResponse");
// Invariant 1: no ranking language in the image or its alt text.
// (Comments stripped first: the word "ranking" in a code comment is fine.)
const content = img
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|\s)\/\/.*$/gm, "")
  .toLowerCase();
for (const banned of ["best", "top ", "#1", "rank", "rating", "review"]) {
  assert.ok(
    !content.includes(banned),
    `preview image must not contain ranking language (${banned})`,
  );
}
assert.ok(
  layout.includes("/opengraph-image") && layout.includes("summary_large_image"),
  "layout must wire og:image + summary_large_image card",
);
console.log("social preview (static): ok");

const base = process.env.BASE;
if (!base) {
  console.log("social preview (live): skipped (set BASE to check a server)");
  process.exit(0);
}

// The image must actually render: 200, image/png, PNG IHDR 1200x630.
const res = await fetch(`${base}/opengraph-image`);
assert.equal(res.status, 200, "opengraph image must return 200");
assert.ok(
  (res.headers.get("content-type") ?? "").includes("image/png"),
  "opengraph image must be image/png",
);
const buf = Buffer.from(await res.arrayBuffer());
assert.deepEqual(buf.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "must be a PNG");
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
assert.equal(width, 1200, "image width must be 1200");
assert.equal(height, 630, "image height must be 630");
console.log(`social preview image: ok (200, image/png, ${width}x${height})`);

// The card must be discoverable: og:image + twitter:card on representative
// routes (per-route titles/canonicals come from each route's metadata).
for (const p of ["/", "/live", "/providers", "/providers/apmix", "/models"]) {
  const r = await fetch(`${base}${p}`);
  const html = await r.text();
  assert.ok(html.includes("og:image"), `${p} must carry og:image`);
  assert.ok(html.includes("summary_large_image"), `${p} must carry the large card`);
  assert.ok(html.includes('rel="canonical"'), `${p} must carry a canonical URL`);
}
console.log("social preview tags: ok (og:image + card + canonical on sample routes)");
console.log("social preview (live): ok");
