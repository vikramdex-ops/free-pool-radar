// APR-057: the methodology page must publish invariant 3 as a limitation,
// not just as a silence rule. Only a source POSITIVELY reporting an ending
// ends an offer - never a silence, never a threshold, never a timeout - and
// a quietly dropped tier surfaces as very_stale via the freshness ladder.
// Run: node scripts/test-methodology-endings.mjs (static).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, "app", "methodology", "page.tsx"),
  "utf8",
);

// 1. The positive rule: only a positive report ends an offer.
assert.ok(
  /only a source positively reporting/i.test(page) ||
    /only a positive report ends an offer/i.test(page),
  "methodology must state only a positive report ends an offer",
);

// 2. The exclusion: no silence, no threshold, no timeout.
assert.ok(
  /never ends an offer because a source went silent/i.test(page),
  "methodology must state silence never ends an offer",
);
assert.ok(
  /no\s+threshold/i.test(page) && /no\s+timeout/i.test(page),
  "methodology must exclude thresholds and timeouts as endings",
);

// 3. The standing answer: a quietly dropped tier surfaces as very stale.
assert.ok(
  /quietly drop/i.test(page) && /very stale/i.test(page),
  "methodology must state a quietly dropped tier surfaces as very stale",
);

// 4. End-evidence framing: ending types are readings from a source.
assert.ok(
  /ending type/i.test(page) && /never an\s+inference from silence/i.test(page),
  "methodology must frame ending types as source readings, not inference",
);

// 5. No positive-absence rule may hide in the copy: endings must never be
// tied to a count of missed sweeps or a duration of absence.
assert.ok(
  !/absent for/i.test(page) &&
    !/consecutive sweeps/i.test(page) &&
    !/after \d+ .*sweeps/i.test(page),
  "methodology must not contain a positive-absence rule",
);

console.log("methodology-endings: ok");
