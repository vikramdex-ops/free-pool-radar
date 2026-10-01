// Stable default order (user ruling: NO ROW EVER MOVES). Freshness as the
// default reshuffled the page every sweep (137 rows into 15 stamps), and
// tie groups without a unique fallthrough come back in arbitrary order.
// Run: node scripts/test-stable-sorts.mjs (static; needs no server).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const browser = fs.readFileSync(
  path.join(root, "components", "LiveBrowser.tsx"),
  "utf8",
);
const db = fs.readFileSync(path.join(root, "lib", "db.ts"), "utf8");
const compare = fs.readFileSync(
  path.join(root, "app", "compare", "page.tsx"),
  "utf8",
);

// 1. The default is a stable lookup key, not freshness. Before the fix the
// default was recently_verified, so this fails on unmodified code.
assert.ok(
  browser.includes('useState<SortKey>("provider_name")'),
  "default sort must be provider_name",
);
assert.ok(
  !browser.includes('useState<SortKey>("recently_verified")'),
  "recently_verified must not remain the default (it stays a reader choice)",
);

// 2. Every comparator falls through to offer id: the invariant is the
// tiebreaker, not any particular order. Eight cases (seven reader sorts
// plus the provider_name default).
const cases = [
  "provider_name",
  "recently_verified",
  "recently_discovered",
  "starting_soon",
  "largest_pool",
  "most_models",
  "recently_changed",
  "recently_ended",
];
for (const c of cases) {
  const at = browser.indexOf(`case "${c}"`);
  assert.ok(at !== -1, `comparator case ${c} must exist`);
  const nextCase = browser.indexOf('case "', at + 10);
  const def = browser.indexOf("default:", at);
  const end = nextCase !== -1 && nextCase < def ? nextCase : def;
  const block = browser.slice(at, end);
  assert.ok(
    block.includes("a.id - b.id"),
    `comparator ${c} must fall through to offer id`,
  );
}
console.log("comparators: ok (8 cases, all id-terminated)");

// 3. Database list reads carry a unique tiebreak so stable client sorts
// inherit determinism instead of arbitrary tie order.
for (const primary of [
  "last_verified_at",
  "ended_at",
  "detected_at",
  "observed_at",
  "display_name",
  "start_at",
  "status",
  "name",
  "provider_slug",
]) {
  // The tiebreak may sit after a .limit() in the chain; order in the final
  // URL is unaffected by builder call order.
  const re = new RegExp(`\\.order\\("${primary}"[^)]*\\)[\\s\\S]{0,120}?\\.order\\("(id|slug|url)"`, "g");
  assert.ok(
    re.test(db),
    `db order on ${primary} must be followed by an id/slug tiebreak`,
  );
}
console.log("db tiebreaks: ok");

// 4. Compare page: lookup order, never route-count order.
assert.ok(
  compare.includes("a.name < b.name"),
  "compare must order providers by name",
);
assert.ok(
  !compare.includes("b.offers.length - a.offers.length"),
  "compare must not order by route count",
);
console.log("stable-sorts: ok");
