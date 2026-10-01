// LED-020: observations must be attributable to their collector.
// The reconcile insert never set source_id, so every row has NULL and
// provenance cannot be reconstructed.
// Run: node scripts/test-observation-source.mjs (static; needs no server).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migPath = path.join(root, "supabase", "migrations", "0014_observation_source.sql");
assert.ok(
  fs.existsSync(migPath),
  "0014_observation_source.sql must exist (LED-020)",
);
const sql = fs.readFileSync(migPath, "utf8");

// Insert-time resolution from the RAW collected fetch URL with
// exactly-one semantics; a guess is worse than a NULL.
assert.ok(
  sql.includes("source_id, source_id_inferred"),
  "observation insert must include source_id",
);
assert.ok(
  sql.includes("v_offer->>'source_url'"),
  "resolution must join on the raw collected fetch URL, not the coalesced official URL",
);
assert.ok(
  /is distinct from 1/.test(sql),
  "resolution must keep NULL unless exactly one source matches",
);
// Backfill fills NULLs only and marks every link inferred.
assert.ok(
  sql.includes("source_id_inferred = true"),
  "backfill must mark reconstructed links inferred",
);
assert.ok(
  sql.includes("o2.source_id is null") && sql.includes("o.source_id is null"),
  "backfill must touch only rows that are still NULL",
);
assert.ok(
  sql.includes("having count(*) = 1"),
  "backfill must link only unambiguous matches",
);
// Additive only: no deletes, no offer-status writes, append-only log untouched
// (a comment may name it; no statement may write it).
assert.ok(!/delete\s+from/i.test(sql), "migration must not delete anything");
assert.ok(
  !/(insert\s+into|update|delete\s+from)\s+discovery_candidate_decisions/i.test(sql),
  "migration must not write the append-only log",
);
// PostgREST must pick the redefined function up (gotcha 5.1).
assert.ok(
  sql.trimEnd().endsWith("select pg_notify('pgrst', 'reload schema');"),
  "migration must end with the pgrst reload notify",
);
console.log("observation-source: ok");
