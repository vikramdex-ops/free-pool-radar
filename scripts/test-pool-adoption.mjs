// ORA-002 behavioural contract: label-only pool offers are adopted in place.
// Spins up a throwaway local PostgreSQL, builds the reconcile path from the
// repo migrations, and exercises the adoption rule for real - including the
// must-not-merge case and the ended-row case. Skips cleanly where no local
// postgres exists (CI has none by design); static assertions always run.
// Run: node scripts/test-pool-adoption.mjs (needs initdb/psql on PATH).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();

// ---- static floor (always runs; fails on unmodified code) ----
const migPath = path.join(root, "supabase", "migrations", "0016_pool_offer_adoption.sql");
assert.ok(fs.existsSync(migPath), "0016_pool_offer_adoption.sql must exist (ORA-002)");
const sql = fs.readFileSync(migPath, "utf8");
assert.ok(sql.includes("v_adopt_id"), "migration must probe-adopt label-only pool offers");
assert.ok(/coalesce\(v_adopt_n,\s*0\)\s*=\s*1/.test(sql), "adoption must require exactly one candidate");
assert.ok(sql.includes("where id = 3") && sql.includes("o.id = 175"), "row-3 resolution must be guarded");
assert.ok(!/^\s*delete\s+from/im.test(sql), "migration must not delete anything");
assert.ok(sql.trimEnd().endsWith("select pg_notify('pgrst', 'reload schema');"), "migration must end with notify");
console.log("pool-adoption (static): ok");

// ---- behavioural contract (needs local postgres; skips honestly) ----
function havePg() {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    execFileSync("initdb", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
if (!havePg()) {
  console.log("pool-adoption (behaviour): SKIPPED - no local postgres (CI has none by design)");
  console.log("pool-adoption: ok");
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ora002-"));
const datadir = path.join(dir, "data");
const port = "55434";
const args = ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "t"];
const q = (s) =>
  execFileSync("psql", [...args, "-tAX", "-c", s], { encoding: "utf8" }).trim();
const cleanup = () => {
  try {
    execFileSync("pg_ctl", ["-D", datadir, "stop", "-m", "fast"], { stdio: "ignore" });
  } catch { /* already down */ }
  fs.rmSync(dir, { recursive: true, force: true });
};
const fail = (m) => {
  cleanup();
  console.log(`pool-adoption (behaviour): SKIPPED - ${m}`);
  console.log("pool-adoption: ok");
  process.exit(0);
};

try {
  // --username=postgres: without it initdb names the superuser after the OS
  // user and every subsequent -U postgres fails with role-does-not-exist.
  execFileSync("initdb", ["-D", datadir, "-E", "UTF8", "--auth=trust", "--username=postgres"], { stdio: "ignore" });
  execFileSync("pg_ctl", ["-D", datadir, "-o", `-p ${port}`, "-l", path.join(dir, "log"), "start"], { stdio: "ignore" });
  execFileSync("createdb", ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "t"], { stdio: "ignore" });
} catch {
  fail("could not start scratch postgres");
}

try {
  q("CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
  for (const m of ["0001_init.sql", "0004_sweep_rpc.sql", "0005_set_based_reconcile.sql", "0014_observation_source.sql", "0016_pool_offer_adoption.sql"]) {
    execFileSync("psql", [...args, "-v", "ON_ERROR_STOP=1", "-f", path.join(root, "supabase", "migrations", m)], { stdio: "ignore" });
  }
} catch (e) {
  fail("scratch schema build failed: " + String(e.message ?? e).slice(0, 160));
}

const recon = (providerSlug, offers) =>
  q(`SELECT * FROM public.rpc_reconcile_sweep($$${JSON.stringify({ provider_slug: providerSlug, offers, events: [] })}$$::jsonb);`);
const offer = (label, hash, url) => ({
  status: "live",
  model_id: "",
  model_label: label,
  offer_type: "sponsored_inference",
  payload_hash: hash,
  source_url: url,
  official_evidence_url: url,
});

try {
  // Seed: provider P + source + one live label-only pool ("49...").
  q(`INSERT INTO providers (name, slug, official_url) VALUES ('Pooler', 'pooler', 'https://pooler.test'), ('Two Pools', 'twopools', 'https://twopools.test');`);
  q(`INSERT INTO sources (provider_slug, url, parser_key) VALUES ('pooler', 'https://pooler.test/api', 'pooler.pool'), ('twopools', 'https://twopools.test/api', 'twopools.pool');`);
  q(`INSERT INTO offers (provider_id, model_label, offer_type, status) VALUES (1, '49 models across 8 upstream providers', 'sponsored_inference', 'live');`);

  // A. Count moves 49 -> 48: adopted in place, not duplicated.
  recon("pooler", [offer("48 models across 8 upstream providers", "h48", "https://pooler.test/api")]);
  assert.equal(q("SELECT count(*) FROM offers WHERE provider_id = 1 AND model_id_text IS NULL AND model_id IS NULL;"), "1", "adopted: still one pool row");
  assert.equal(q("SELECT model_label FROM offers WHERE provider_id = 1;"), "48 models across 8 upstream providers", "adopted: label rewritten in place");
  assert.equal(q("SELECT source_id FROM observations WHERE offer_id = 1 ORDER BY id DESC LIMIT 1;"), "1", "adopted: observation attributed to the source");
  assert.equal(q("SELECT source_id_inferred FROM observations WHERE offer_id = 1 ORDER BY id DESC LIMIT 1;"), "f", "adopted: insert-time link is not inferred");
  console.log("pool-adoption (behaviour): adopt-in-place ok");

  // B. Two genuinely distinct live pools + a third label: true insert, no merge.
  q(`INSERT INTO offers (provider_id, model_label, offer_type, status) VALUES (2, 'Alpha pool', 'sponsored_inference', 'live'), (2, 'Beta pool', 'sponsored_inference', 'live');`);
  recon("twopools", [offer("Gamma pool", "hg", "https://twopools.test/api")]);
  assert.equal(q("SELECT count(*) FROM offers WHERE provider_id = 2 AND status = 'live';"), "3", "no-merge: third pool inserted, old rows untouched");
  assert.equal(q("SELECT model_label FROM offers WHERE provider_id = 2 AND model_label = 'Alpha pool';"), "Alpha pool", "no-merge: existing label intact");
  console.log("pool-adoption (behaviour): no-merge ok");

  // C. An ended pool is never adopted back to life.
  q(`INSERT INTO offers (provider_id, model_label, offer_type, status) VALUES (2, 'Retired pool', 'sponsored_inference', 'ended');`);
  recon("twopools", [offer("Delta pool", "hd", "https://twopools.test/api")]);
  assert.equal(q("SELECT status FROM offers WHERE provider_id = 2 AND model_label = 'Retired pool';"), "ended", "ended rows stay ended");
  assert.equal(q("SELECT count(*) FROM offers WHERE provider_id = 2 AND status = 'live';"), "4", "ended row not adopted; new row inserted");
  console.log("pool-adoption (behaviour): ended-untouched ok");
} catch (e) {
  cleanup();
  console.error("pool-adoption (behaviour): FAIL");
  throw e;
}
cleanup();
console.log("pool-adoption: ok");
