// VIS-008: the methodology page must not claim every sweep appends an
// observation. The sweep deliberately writes one only when the collected
// payload differs (§78 no-op rule); an identical payload refreshes
// last_verified_at instead. That is why 7 observations span 23 sweeps.
// Run: node scripts/test-methodology-observations.mjs (static).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, "app", "methodology", "page.tsx"),
  "utf8",
);

// The false sentence fails this before the fix and passes after.
assert.ok(
  !page.includes("Every sweep appends an observation"),
  "methodology must not claim every sweep appends an observation",
);
assert.ok(
  /differs from the stored one/.test(page),
  "methodology must state observations are change-gated",
);
console.log("methodology copy: ok");

// The copy must match the designed behavior, not just avoid the sentence:
// the reconcile function writes observations only on payload change.
const rpc = fs.readFileSync(
  path.join(root, "supabase", "migrations", "0005_set_based_reconcile.sql"),
  "utf8",
);
assert.ok(
  rpc.includes("is a no-op apart from freshness"),
  "reconcile must keep the §78 identical-payload no-op rule the copy describes",
);
assert.ok(
  rpc.includes("insert into observations"),
  "reconcile must still append observations on change",
);
console.log("copy matches implementation: ok");
console.log("methodology-observations: ok");
