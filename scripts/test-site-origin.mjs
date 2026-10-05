// APR-022: one single source of origin; no hardcoded production literals.
//
// app/sitemap.ts, app/robots.ts, app/layout.tsx and components/JsonLd.tsx
// each carried its own "https://free-pool-radar.vercel.app" literal, so every
// fork emitted production canonicals and sitemap entries. lib/site.ts reads
// NEXT_PUBLIC_SITE_URL (documented in .env.example) with the production
// origin as default, so production behaviour is unchanged.
//
// Run: node scripts/test-site-origin.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const LITERAL = "https://free-pool-radar.vercel.app";

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

// 1. No hardcoded production origin in the four routed files.
for (const f of [
  "app/sitemap.ts",
  "app/robots.ts",
  "app/layout.tsx",
  "components/JsonLd.tsx",
]) {
  const src = readFileSync(join(root, f), "utf8");
  check(
    `${f} carries no hardcoded origin`,
    !src.includes(LITERAL),
    `${f} still contains the production literal`,
  );
}

// 2. Default resolves to the production origin when the variable is unset.
delete process.env.NEXT_PUBLIC_SITE_URL;
{
  const m = await import(`../lib/site.ts?t=${Date.now()}a`);
  check(
    "default origin is production",
    m.SITE_URL === LITERAL,
    `default resolved to ${m.SITE_URL}`,
  );
}

// 3. Env override wins, trailing slashes stripped.
process.env.NEXT_PUBLIC_SITE_URL = "https://fork.example/";
{
  const m = await import(`../lib/site.ts?t=${Date.now()}b`);
  check(
    "env origin wins without trailing slash",
    m.SITE_URL === "https://fork.example",
    `override resolved to ${m.SITE_URL}`,
  );
  delete process.env.NEXT_PUBLIC_SITE_URL;
}

// 4. JsonLd keeps exporting SITE_URL so its seven importers are untouched.
{
  const src = readFileSync(join(root, "components", "JsonLd.tsx"), "utf8");
  check(
    "JsonLd still exports SITE_URL",
    /export \{ SITE_URL \}( from "@\/lib\/site")?|export const SITE_URL/.test(src),
    "JsonLd.tsx must keep exporting SITE_URL for its importers",
  );
}

if (failures > 0) {
  console.error(`\n${failures} origin assertion(s) failed`);
  process.exit(1);
}
console.log("\nAPR-022 green: one origin, read from the environment");
