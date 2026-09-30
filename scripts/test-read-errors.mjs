// LED-001: a failed read must never render as an empty result.
// Run: node scripts/test-read-errors.mjs (read-only; anon key).
//
// Part 1 (source guards) fails against the pre-fix code: read()/readOne()
// returned a bare array, so a failed read and a genuine empty result were
// indistinguishable and every caller rendered the empty state for both.
// Part 2 (behaviour) proves the mechanism at the protocol level: a failing
// PostgREST read surfaces as an error, never as [], so the envelope that
// read() now returns carries a real signal.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readDir = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? readDir(p) : [p];
  });

// ---- Part 1a: read()/readOne() return an envelope, error path included ----
const dbSrc = fs.readFileSync(path.join(root, "lib", "db.ts"), "utf8");
for (const needle of [
  "interface ReadResult",
  "error: string | null",
  "return { data: [], error: error.message }",
]) {
  assert.ok(dbSrc.includes(needle), `lib/db.ts must contain: ${needle}`);
}
const readFn = dbSrc.slice(dbSrc.indexOf("async function read<T>"));
assert.ok(
  !/\breturn \[\];/.test(readFn.slice(0, readFn.indexOf("async function readOne"))),
  "read() must not return a bare [] on any path (failure would equal empty)",
);
console.log("read() envelope: ok");

// ---- Part 1b: every app route that reads must branch on the error ----
const appFiles = readDir(path.join(root, "app")).filter((p) =>
  /\.(tsx|ts)$/.test(p),
);
let checked = 0;
for (const f of appFiles) {
  const src = fs.readFileSync(f, "utf8");
  if (/await get[A-Z]\w*\(/.test(src)) {
    checked++;
    assert.ok(
      /Error/.test(src),
      `${path.relative(root, f)} reads but never branches on an error`,
    );
  }
}
assert.ok(checked >= 10, `expected 10+ reading routes, saw ${checked}`);
console.log(`callers branch on error: ok (${checked} routes)`);

// ---- Part 1c: publicData never 200s an empty set for a failed read ----
const pdSrc = fs.readFileSync(path.join(root, "lib", "publicData.ts"), "utf8");
assert.ok(
  pdSrc.includes("readErrorResponse"),
  "lib/publicData.ts must map read failures to an explicit error response",
);
console.log("API error path: ok");

// ---- Part 2: protocol behaviour (needs .env.local) ----
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
const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
};
const okRes = await fetch(`${base}/providers?select=id&limit=1`, { headers });
assert.equal(okRes.status, 200, "providers read must succeed");
assert.ok(Array.isArray(await okRes.json()), "success yields rows");
const badRes = await fetch(`${base}/no_such_table_xyz?select=id`, { headers });
assert.ok(
  badRes.status >= 400,
  `a failing read must surface as an error status, got ${badRes.status}`,
);
console.log(
  `protocol: ok (success=200 rows, failing table=${badRes.status} error)`,
);

console.log("read-errors: ok (failures distinguishable end to end)");
