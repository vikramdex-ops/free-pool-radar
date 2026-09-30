// Computes the CSP sha256 hash of the theme init script served in <head>.
// The script is a TS template literal in lib/theme.ts with two interpolations
// (THEME_KEY, DEFAULT_THEME); this evaluates them exactly as the module does
// and hashes the resulting bytes. Run: node scripts/csp-hash.mjs
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function fail(m) {
  console.error(`csp-hash: FAIL: ${m}`);
  process.exit(1);
}

const root = process.cwd();
const src = fs.readFileSync(path.join(root, "lib", "theme.ts"), "utf8");

const keyM = src.match(/THEME_KEY\s*=\s*"([^"]+)"/);
const defM = src.match(/DEFAULT_THEME\s*=\s*"([^"]+)"/);
if (!keyM || !defM) fail("could not read THEME_KEY/DEFAULT_THEME from lib/theme.ts");

const litM = src.match(/themeInitScript\s*=\s*`([\s\S]*?)`;/);
if (!litM) fail("could not extract themeInitScript literal from lib/theme.ts");
const script = litM[1]
  .replace(/\$\{JSON\.stringify\(THEME_KEY\)\}/g, JSON.stringify(keyM[1]))
  .replace(/\$\{JSON\.stringify\(DEFAULT_THEME\)\}/g, JSON.stringify(defM[1]))
  // Served bytes are LF: the bundler normalises on-disk CRLF away (proved by
  // hashing the served HTML), so hash the normalised form or the hash
  // silently mismatches on every Windows checkout.
  .replace(/\r\n/g, "\n");
if (script.includes("${")) fail("unresolved interpolation left in theme script");

const hash = createHash("sha256").update(script, "utf8").digest("base64");
console.log(`'sha256-${hash}'`);
