// VIS-012: No card / No subscription match every live offer, so the controls
// are labelled as the standing market fact they are instead of implying
// they narrow anything. Filter logic is deliberately untouched: it becomes
// meaningful again the moment a card-required route exists.
// Run: node scripts/test-universal-filters.mjs (static).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const browser = fs.readFileSync(
  path.join(root, "components", "LiveBrowser.tsx"),
  "utf8",
);
const live = fs.readFileSync(path.join(root, "app", "live", "page.tsx"), "utf8");

// The standing-fact presentation must exist...
assert.ok(
  browser.includes("True of every tracked route at present"),
  "LiveBrowser must label the universal pills as a standing fact",
);
assert.ok(
  browser.includes("confirm the market as it stands rather than narrowing it"),
  "LiveBrowser must state the pills confirm rather than narrow",
);
assert.ok(
  live.includes("those two pills confirm rather than narrow"),
  "/live lede must not imply no-card narrows anything",
);
// ...while the filter logic stays exactly as it was (correct, and live
// again the moment data varies). Before the fix there was no standing-fact
// copy, so this fails on unmodified code.
assert.ok(
  browser.includes("!o.card_required"),
  "cardless filter logic must be untouched",
);
assert.ok(
  browser.includes("!o.access_requires_subscription"),
  "subless filter logic must be untouched",
);
console.log("universal-filters: ok");
