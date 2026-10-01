// VIS-005: providers.free_model_count is the collector-reported catalogue
// count, not held identifiers - so user-facing labels must not call it
// "Free model ids" (freetheai reports 48 while we hold 0 of its ids).
// The ruled noun is "Free models listed" (matching lib/search.ts:278).
// Labels carrying genuine ids (hero distinct-id stat) keep their noun.
// Run: node scripts/test-free-models-listed.mjs (static; needs no server).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const provider = read("app/providers/[slug]/page.tsx");
const hero = read("components/Hero.tsx");
const registry = read("components/Registry.tsx");

// The three surfaces rendering the catalogue-count column carry the ruled noun.
for (const [name, src] of [["provider page", provider], ["hero ticker", hero], ["registry", registry]]) {
  assert.ok(/free models listed/i.test(src), `${name} must use the ruled noun`);
}
// ...and the wrong noun is gone from exactly those surfaces.
for (const [name, src] of [["provider page", provider], ["hero ticker", hero], ["registry", registry]]) {
  assert.ok(!src.includes("Free model ids"), `${name} must not call the count "ids"`);
}
// The hero's distinct-ids stat genuinely holds identifiers, so its noun stays.
const stats = read("components/RadarStats.tsx");
assert.ok(stats.includes("Free model ids"), "genuine held-ids stat keeps its noun");
console.log("free-models-listed: ok");
