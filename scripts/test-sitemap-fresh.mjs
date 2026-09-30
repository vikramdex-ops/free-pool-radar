// PUL-002 follow-up: the sitemap must regenerate when data changes, never
// bake build-time slugs (invariant 8, §76).
// Run: node scripts/test-sitemap-fresh.mjs (static) and, with a server up,
//   BASE=http://localhost:3111 node scripts/test-sitemap-fresh.mjs (live).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = fs.readFileSync(path.join(root, "app", "sitemap.ts"), "utf8");

// The defect that would have shipped quietly: a prerendered sitemap.
// force-dynamic keeps it live; generateStaticParams would pin slugs at build.
assert.ok(
  /export const dynamic\s*=\s*["']force-dynamic["']/.test(src),
  "app/sitemap.ts must export const dynamic = force-dynamic",
);
assert.ok(
  !src.includes("generateStaticParams"),
  "app/sitemap.ts must not pin slugs with generateStaticParams",
);
assert.ok(
  src.includes("getProviders") &&
    src.includes("getModels") &&
    src.includes("getEvents"),
  "app/sitemap.ts must enumerate slugs from the database, not hard-code them",
);
console.log("sitemap freshness (static): ok");

const base = process.env.BASE;
if (!base) {
  console.log("sitemap freshness (live): skipped (set BASE to check a server)");
  process.exit(0);
}

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
const headers = {
  apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
};

// The sitemap's lastmod values must match the database rows they describe.
// A baked sitemap would still match until data moves, so this proves the
// code path enumerates live; the force-dynamic assertion above is what pins
// regeneration to request time rather than build time.
const [smRes, provRes] = await Promise.all([
  fetch(`${base}/sitemap.xml`),
  fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/providers?select=slug,updated_at,last_verified_at&limit=100`,
    { headers },
  ),
]);
assert.equal(smRes.status, 200, "sitemap.xml must return 200");
const xml = await smRes.text();
assert.ok(
  xml.includes("<urlset") && xml.includes("/providers/"),
  "sitemap.xml must be a urlset with provider URLs",
);
const providers = await provRes.json();
let checked = 0;
for (const p of providers.slice(0, 5)) {
  const want = (p.last_verified_at ?? p.updated_at)?.slice(0, 10);
  const re = new RegExp(
    `<loc>[^<]*\\/providers\\/${p.slug}<\\/loc>\\s*<lastmod>([^<]*)<\\/lastmod>`,
  );
  const m = xml.match(re);
  assert.ok(m, `sitemap must list /providers/${p.slug} with a lastmod`);
  assert.ok(
    m[1].slice(0, 10) === want,
    `/providers/${p.slug} lastmod ${m[1].slice(0, 10)} must match the database ${want}`,
  );
  checked++;
}
assert.ok(checked > 0, "must compare at least one provider lastmod");
console.log(`sitemap freshness (live): ok (${checked} lastmods match the DB)`);
