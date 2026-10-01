// SEN-005: /api/offers and /api/live served the same livePayload() body
// from separate ISR entries with independent revalidation clocks, so the
// two URLs could disagree for up to 360s after a write. /api/offers is
// now a 307 alias for canonical /api/live: one body, structural identity.
// Run: node scripts/test-api-alias.mjs (static) and, with a server up,
//   BASE=http://localhost:3xxx node scripts/test-api-alias.mjs (live).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const alias = fs.readFileSync(path.join(root, "app", "api", "offers", "route.ts"), "utf8");
const canonical = fs.readFileSync(path.join(root, "app", "api", "live", "route.ts"), "utf8");

// The alias must redirect (307, temporary and reversible), never serve a
// body of its own. Before the fix it imported livePayload and returned 200.
assert.ok(!alias.includes("livePayload()"), "/api/offers must not build a body of its own");
assert.ok(!alias.includes("lib/publicData"), "/api/offers must not import the payload builder");
assert.ok(alias.includes("307"), "/api/offers must redirect with 307, not 308");
assert.ok(!/, 308/.test(alias), "308 would let intermediaries cache it permanently");
assert.ok(alias.includes('"/api/live"'), "/api/offers must resolve to canonical /api/live");
// The canonical route still serves the payload itself.
assert.ok(canonical.includes("livePayload"), "/api/live must still serve livePayload");
// No in-site link should pay the alias round trip.
for (const f of ["app/page.tsx", "components/Hero.tsx"]) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  assert.ok(!src.includes('href="/api/offers"'), `${f} must link canonical /api/live, not the alias`);
}
console.log("api-alias (static): ok");

const base = process.env.BASE;
if (!base) {
  console.log("api-alias (live): skipped (set BASE to check a server)");
  process.exit(0);
}
const res = await fetch(`${base}/api/offers`, { redirect: "manual" });
assert.equal(res.status, 307, "/api/offers must return 307");
const loc = res.headers.get("location") ?? "";
assert.ok(loc.endsWith("/api/live"), `Location must resolve to /api/live, got ${loc}`);
const [a, b] = await Promise.all([
  fetch(`${base}/api/live`).then((r) => r.text()),
  fetch(`${base}/api/offers`).then((r) => r.text()),
]);
assert.equal(a, b, "alias and canonical bodies must be byte-identical");
console.log("api-alias (live): ok (307 + Location + identical bodies)");
