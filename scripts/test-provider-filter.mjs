// ORA-001: a provider page must return only that provider's offers.
// Run: node scripts/test-provider-filter.mjs (read-only; anon key).
//
// Part 1 (regression guard) fails against the pre-fix code: it asserts
// getOffersForProvider no longer filters on the embedded relation
// `provider.slug`, which PostgREST does not apply without an inner join,
// so the predicate silently matched nothing and every provider page
// listed the whole site.
// Part 2 (behaviour) proves the replacement predicate actually filters
// at the PostgREST level: two provider slugs must yield differing sets,
// each pure and each a subset of the site-wide set.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

// ---- Part 1: source guard ----
const src = fs.readFileSync(path.join(root, "lib", "db.ts"), "utf8");
const fn = src.slice(src.indexOf("getOffersForProvider"));
assert.ok(fn.length > 0, "getOffersForProvider must exist in lib/db.ts");
assert.ok(
  !fn.slice(0, 900).includes('"provider.slug"'),
  'getOffersForProvider must not filter on the embedded relation "provider.slug" (ORA-001)',
);
assert.ok(
  fn.slice(0, 900).includes('"provider_id"'),
  "getOffersForProvider must filter on the real provider_id column",
);
console.log("source guard: ok (no embedded-relation filter)");

// ---- Part 2: behaviour against the live database ----
function loadEnv() {
  const env = {};
  for (const line of fs
    .readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, ".env.local must hold the public Supabase URL + key");

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const WITH_PROVIDER =
  "*, provider:providers!offers_provider_id_fkey(id,name,slug,official_url)";

const { data: providers, error: pErr } = await db
  .from("providers")
  .select("id,slug")
  .order("name")
  .limit(50);
assert.ifError(pErr);
assert.ok(providers.length >= 2, "need at least two providers to compare");
const [a, b] = providers.slice(0, 2);

async function offersFor(provider) {
  const { data, error } = await db
    .from("offers")
    .select(WITH_PROVIDER)
    .eq("provider_id", provider.id)
    .order("status")
    .limit(500);
  assert.ifError(error);
  return data;
}

const { data: allOffers, error: allErr } = await db
  .from("offers")
  .select("id")
  .limit(2000);
assert.ifError(allErr);
const siteIds = new Set(allOffers.map((o) => o.id));

const [oa, ob] = await Promise.all([offersFor(a), offersFor(b)]);
const idsA = new Set(oa.map((o) => o.id));
const idsB = new Set(ob.map((o) => o.id));
console.log(
  `site-wide offers: ${siteIds.size}; ${a.slug}: ${oa.length}; ${b.slug}: ${ob.length}`,
);

for (const o of oa) {
  assert.equal(
    o.provider?.slug,
    a.slug,
    `offer ${o.id} on ${a.slug} belongs to ${o.provider?.slug}`,
  );
  assert.ok(siteIds.has(o.id), `offer ${o.id} must be in the site-wide set`);
}
for (const o of ob) {
  assert.equal(
    o.provider?.slug,
    b.slug,
    `offer ${o.id} on ${b.slug} belongs to ${o.provider?.slug}`,
  );
  assert.ok(siteIds.has(o.id), `offer ${o.id} must be in the site-wide set`);
}
const same =
  idsA.size === idsB.size && [...idsA].every((id) => idsB.has(id));
assert.ok(!same, `${a.slug} and ${b.slug} must not return identical offer sets`);

// ---- Informational only: what the old predicate did (never fails) ----
try {
  const { data, error } = await db
    .from("offers")
    .select(WITH_PROVIDER)
    .eq("provider.slug", a.slug)
    .order("status")
    .limit(500);
  if (error) {
    console.log(`old predicate probe: PostgREST error: ${error.message}`);
  } else {
    const foreign = data.filter((o) => o.provider?.slug !== a.slug).length;
    console.log(
      `old predicate probe: eq("provider.slug","${a.slug}") returned ${data.length} rows, ${foreign} belonging to other providers`,
    );
  }
} catch (e) {
  console.log(`old predicate probe: threw: ${String(e).slice(0, 120)}`);
}

console.log("provider-filter: ok (pure per-provider sets, subsets of site)");
