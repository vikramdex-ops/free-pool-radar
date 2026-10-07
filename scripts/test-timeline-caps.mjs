// VIS-063: a route that renders everything it was given satisfies "removes no
// content" only while the data stays under the cap it was given.
//
// Measured 2026-10-05: /timeline renders 184 entries at both 390px and 1200px,
// so it removes nothing by width and CEO-R07's count-and-control clause does
// not fire on it. But app/timeline/page.tsx:19 reads getTimeline(300) and
// lib/db.ts:407 defaults to limit = 300, and app/search/page.tsx:56 reads
// getTimeline(500). The changes table holds 184 rows today. The moment it
// passes 300 the route silently drops rows, the page still claims to show
// every difference detected between sweeps, and nothing on screen says a cap
// exists. Three caps, none of them stated.
//
// The rule: any call site that passes an explicit limit to a capped reader must
// either state the cap on the page, or be rendered with a control that reaches
// the rest. A cap nobody can see is indistinguishable from no cap, which is
// the one thing a tracker must not be.
//
// Honesty label: static source assertion. It proves each cap has a stated
// counterpart; it cannot prove the page is honest about rows it has not yet
// dropped, because with 184 rows nothing drops today. That is the point — the
// defect is latent and only a static check can see it before it fires.
//
// Run: node scripts/test-timeline-caps.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const db = stripComments(read("lib/db.ts"));
const timeline = stripComments(read("app/timeline/page.tsx"));
const search = stripComments(read("app/search/page.tsx"));

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

function callSites(source, fn) {
  return [...source.matchAll(new RegExp(`${fn}\\s*\\(([^)]*)\\)`, "g"))].map((m) =>
    m[1].trim(),
  );
}

// Every call site that names its own limit is a site that can drop rows the
// reader cannot reach. Each must carry a stated counterpart.
const timelineArg = callSites(timeline, "getTimeline")[0];
const searchArg = callSites(search, "getTimeline")[0];

// The single substantive check. One defect, one failure: /timeline presents the
// change table as the page's content, so a cap on its read is a count claim
// about the page and must be stated in visible copy. A paging control may be
// added but does not discharge this, because the page calls itself the record
// of every difference detected between sweeps.
//
// /search is deliberately excluded. It matches within the table rather than
// presenting it, so its 500-row window is not a claim about what the page
// contains and needs no caption. /timeline reading 300 while /search reads 500
// is not by itself a count-honesty defect; if it becomes one it is a
// search-coverage finding, which is a different clause and a different owner.
check("the route that renders the table states its cap", () => {
  assert.match(
    timeline,
    /getTimeline\((\d+)\)/,
    "app/timeline/page.tsx no longer passes an explicit limit; re-read this test rather than deleting it",
  );
  assert.match(search, /getTimeline\(\d+\)/, "app/search/page.tsx no longer passes an explicit window");
  assert.ok(
    /cap|truncat|showing|limit of/i.test(timeline),
    "app/timeline/page.tsx presents the change table as the page's content, so a cap on its read is a count claim about the page and must appear in visible copy",
  );
});

// The default is a cap too, and it is the one that bites: a future call site
// that passes no argument gets 300 with no way to ask for more. It must live in
// one place so a change to it cannot pass silently.
check("the default limit is declared once, in the reader", () => {
  const defaults = [...db.matchAll(/export const getTimeline = \(limit = (\d+)\)/g)];
  assert.equal(defaults.length, 1, "getTimeline's default limit must be declared exactly once");
  assert.equal(
    defaults[0][1],
    timeline.match(/getTimeline\((\d+)\)/)[1],
    "the default and the explicit call-site cap have diverged; whichever is smaller silently wins and the pages will disagree",
  );
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nevery capped read states its cap or offers a way past it");
