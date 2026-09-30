// CIP-003: the CSP hash in next.config.ts must match lib/theme.ts, and the
// script policy must never be widened to 'unsafe-inline'.
// Run: node scripts/test-csp-hash.mjs (static; needs no server).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const config = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");

// The hash allowlisting the theme init script must be the one csp-hash.mjs
// derives from the current lib/theme.ts. Before the fix there was no hash
// at all, so this fails on unprotected config.
const hash = execFileSync("node", [path.join(root, "scripts", "csp-hash.mjs")], {
  encoding: "utf8",
}).trim();
assert.ok(
  config.includes(hash),
  "next.config.ts must carry the current theme-script hash from scripts/csp-hash.mjs",
);
console.log(`theme hash pinned: ok (${hash.slice(0, 20)}…)`);

// Report-Only ships first; the enforcing header must not appear until the
// console is proven clean and the JSON-LD interaction is reconciled.
assert.ok(
  config.includes("Content-Security-Policy-Report-Only"),
  "CSP must ship Report-Only first",
);
const enforcing = /key:\s*"Content-Security-Policy"/.test(
  config.replace("Content-Security-Policy-Report-Only", ""),
);
assert.ok(!enforcing, "the enforcing CSP header must not ship yet");
console.log("report-only phase: ok");

// 'unsafe-inline' for scripts would make the policy decorative. It is
// allowed for styles only (React style attributes need it).
const scriptSrc = config.match(/script-src[^;"]*/)?.[0] ?? "";
assert.ok(
  !scriptSrc.includes("unsafe-inline"),
  "script-src must never contain 'unsafe-inline'",
);
console.log("script-src tight: ok");

// Permissions-Policy stays restrictive and additive.
for (const t of ["camera=()", "microphone=()", "geolocation=()"]) {
  assert.ok(config.includes(t), `Permissions-Policy must deny ${t}`);
}
console.log("permissions-policy: ok");

console.log("csp-hash: ok");
