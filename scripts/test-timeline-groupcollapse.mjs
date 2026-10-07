// DEC-T23-GROUPCOLLAPSE: wire groupChanges() into /timeline.
//
// A sweep that discovers eighteen new routes at one provider produces
// eighteen rows reading as the same line. ChangeFeed already collapses
// those; /timeline renders every row raw. The fix is one import and one
// call: groupChanges() applied to each day's rows, rendered with GroupRow.
//
// RED-FIRST: this fails on the pre-change tree (groupChanges is private to
// Feed.tsx and /timeline never calls it) and passes after. It asserts the
// wiring, not the grouping arithmetic — the arithmetic is observed on the
// deployed page, where the figures move every sweep.
//
// Run: node scripts/test-timeline-groupcollapse.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const feed = stripComments(read("components/Feed.tsx"));
const timeline = stripComments(read("app/timeline/page.tsx"));

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

check("Feed exports groupChanges for reuse", () => {
  assert.match(
    feed,
    /export function groupChanges/,
    "groupChanges is still private to Feed.tsx",
  );
});

check("Feed exports GroupRow so the timeline shares one rendering path", () => {
  assert.match(
    feed,
    /export function GroupRow/,
    "GroupRow is still private; /timeline would need a second markup",
  );
});

check("/timeline imports the grouping", () => {
  assert.match(
    timeline,
    /import \{[^}]*groupChanges[^}]*\} from "@\/components\/Feed"/,
    "/timeline does not import groupChanges",
  );
});

check("/timeline groups each day before rendering", () => {
  assert.match(
    timeline,
    /groupChanges\(rows\)/,
    "/timeline renders raw day rows with no duplicate collapsing",
  );
  assert.match(
    timeline,
    /<GroupRow\b/,
    "/timeline does not render the shared grouped row",
  );
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n/timeline collapses duplicate changes inside each day");
