// ORA-002: two contradictory live rows for one freetheai pool route, because
// pool offers carry no model id and the label (which embeds a moving count)
// is their only reconcile identity. When the count moved 49 -> 48 the label
// lookup missed, a lookalike row was inserted, and the old row orphaned.
// Run: node scripts/test-pool-adoption.mjs (static; needs no server).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migPath = path.join(root, "supabase", "migrations", "0016_pool_offer_adoption.sql");
assert.ok(fs.existsSync(migPath), "0016_pool_offer_adoption.sql must exist (ORA-002)");
const sql = fs.readFileSync(migPath, "utf8");

// The contract: label misses on model-id-less offers fall back to adopting
// exactly one live same-(provider,type) row with no model id, in place.
assert.ok(
  sql.includes("v_adopt_id"),
  "migration must probe-adopt label-only pool offers",
);
assert.ok(
  /coalesce\(v_adopt_n,\s*0\)\s*=\s*1/.test(sql),
  "adoption must require exactly one candidate (never merge distinct pools)",
);
assert.ok(
  sql.includes("o.model_id_text is null") && sql.includes("o.model_id is null"),
  "adoption key must be (provider, type) with no model id",
);
// The existing orphan is resolved by id with its evidence pinned, not by hand-waving.
assert.ok(
  sql.includes("where id = 3") && sql.includes("o.id = 175"),
  "row-3 resolution must be guarded by row 175's exact expected state",
);
assert.ok(
  sql.includes("Superseded by offer 175"),
  "row 3 must be ended WITH a reason, never silently",
);
// Additive otherwise: no deletes, append-only log untouched, signature kept.
assert.ok(!/^\s*delete\s+from/im.test(sql), "migration must not delete anything");
assert.ok(
  !/(insert\s+into|update|delete\s+from)\s+discovery_candidate_decisions/i.test(sql),
  "migration must not write the append-only log",
);
assert.ok(
  /create\s+or\s+replace\s+function\s+public\.rpc_reconcile_sweep/i.test(sql),
  "must redefine in place, never drop",
);
// PostgREST must pick the redefined function up (gotcha 5.1).
assert.ok(
  sql.trimEnd().endsWith("select pg_notify('pgrst', 'reload schema');"),
  "migration must end with the pgrst reload notify",
);
console.log("pool-adoption: ok");
