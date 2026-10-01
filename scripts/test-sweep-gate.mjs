// SEN-003: sweeps ran every 6h instead of 5h because the due gate compared
// with microsecond exactness while the claiming tick stamps last_run_at
// milliseconds after its own start - any +5h tick arriving a hair earlier
// returned not-due, costing exactly one hour (hence all gaps exactly 360).
// Run: node scripts/test-sweep-gate.mjs (static; needs no server).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migPath = path.join(root, "supabase", "migrations", "0015_sweep_gate_tolerance.sql");
assert.ok(fs.existsSync(migPath), "0015_sweep_gate_tolerance.sql must exist (SEN-003)");
const sql = fs.readFileSync(migPath, "utf8");

// The tolerance that fixes the boundary race. Before the fix the comparison
// was exact, so this fails on unmodified code.
assert.ok(
  /interval\s+'5 minutes'/.test(sql),
  "due comparison must tolerate 5 minutes",
);
assert.ok(
  sql.includes("timeout_milliseconds => 60000"),
  "pg_net dispatch must allow 60s (sweeps take 10-20s; 5s timed out every run)",
);
// The 5-hour cadence itself is untouched: nothing writes a new interval
// value (the function only reads interval_hours when claiming its slot).
assert.ok(
  !/set\s+interval_hours/i.test(sql),
  "must not change the 5-hour cadence value",
);
assert.ok(
  /make_interval\(hours\s*=>/.test(sql),
  "the hour-based interval expression must remain",
);
// CREATE OR REPLACE only: no drops, no truncation, nothing deleted.
assert.ok(
  /create\s+or\s+replace\s+function\s+public\.tick_radar_sweep/i.test(sql),
  "must redefine tick_radar_sweep in place",
);
assert.ok(
  !/^\s*drop\s+/im.test(sql),
  "must not drop anything",
);
assert.ok(
  !/truncate/i.test(sql),
  "must not truncate anything",
);
// PostgREST must pick the redefined function up (gotcha 5.1).
assert.ok(
  sql.trimEnd().endsWith("select pg_notify('pgrst', 'reload schema');"),
  "migration must end with the pgrst reload notify",
);
console.log("sweep-gate: ok");
