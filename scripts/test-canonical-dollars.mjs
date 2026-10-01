// ORA-006: the sponsored pool stored micro-dollar magnitudes labelled
// dollars (pool_size 37000000 beside a description reading $37.00), because
// the collector multiplied dollar figures by 1e6. Canonical dollars are now
// stored; history rows are untouched and heal through normal sweep rewrites.
// This test runs the real collector against a stubbed sponsor API and
// asserts the STORED values - the page was never the broken part.
// Run: node scripts/test-canonical-dollars.mjs (transpiles collectors.ts).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const src = path.join(root, "supabase", "functions", "radar-sweep", "core", "collectors.ts");
assert.ok(fs.existsSync(src), "collectors.ts must exist");

// The 1e6 scaling must be gone from pool figures (description keeps cents).
const text = fs.readFileSync(src, "utf8");
assert.ok(!text.includes("* 1e6"), "collector must not scale pool figures by 1e6");
console.log("collector scaling: ok (no 1e6 factor)");

// Behavioural: stub the sponsor API (cents, as the real one reports) and
// run the actual sponsoredtokens collector.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ora006-"));
try {
  execFileSync(
    process.execPath,
    [path.join(root, "node_modules", "typescript", "bin", "tsc"), "--ignoreConfig", src, "--outDir", dir, "--module", "esnext", "--target", "es2022", "--skipLibCheck", "--lib", "es2022,dom"],
    { cwd: root, stdio: "ignore" },
  );
  const mod = await import(pathToFileURL(path.join(dir, "collectors.js")).href);
  const collector = mod.COLLECTOR_BY_KEY.get("sponsoredtokens.pool");
  assert.ok(collector, "sponsoredtokens.pool collector must be registered");

  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/api/sponsors")) {
      return Response.json({
        sponsors: [
          { balanceCents: 2000, lifetimeCents: 2500, spentCents: 500 },
          { balanceCents: 1305, lifetimeCents: 1200, spentCents: 345 },
        ],
      });
    }
    if (String(url).endsWith("/api/flags")) {
      return Response.json({ poolPaused: false });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  // Totals: balance $33.05, lifetime $37.00, spent $8.45.
  const result = await collector.collect();
  const offer = result.offers[0];
  const event = result.events[0];
  assert.equal(offer.poolSize, 37, `offer poolSize must be canonical $37, got ${offer.poolSize}`);
  assert.equal(offer.poolRemaining, 33, `offer poolRemaining must be canonical $33, got ${offer.poolRemaining}`);
  assert.equal(offer.poolUnit, "dollars");
  assert.equal(event.poolSize, 37, `event poolSize must be canonical $37, got ${event.poolSize}`);
  assert.equal(event.poolRemaining, 33, `event poolRemaining must be canonical $33, got ${event.poolRemaining}`);
  assert.equal(event.unit, "dollars");
  assert.ok(
    event.description.includes("$37.00"),
    "description keeps exact cents while pool fields carry whole dollars",
  );
  console.log("collector behaviour: ok (stored values are canonical dollars)");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("canonical-dollars: ok");
