/* Lists every non-ASCII sequence in the source, with codepoints.
   Useful for identifying which characters are intentional and which are
   mojibake before repairing anything. */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.argv[2] ?? ".";
const EXTS = new Set([".ts", ".tsx", ".md", ".sql", ".css"]);
const SKIP = new Set(["node_modules", ".next", ".git", ".vercel", ".review"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

const found = new Map();

for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/[^\x00-\x7F]+/gu)) {
    const s = m[0];
    const cps = [...s].map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"));
    const key = `${cps.join(" ")}  '${s}'`;
    if (!found.has(key)) found.set(key, new Set());
    found.get(key).add(relative(ROOT, file));
  }
}

for (const [key, files] of [...found.entries()].sort()) {
  const list = [...files];
  console.log(`${key}   x${list.length}   ${list.slice(0, 3).join(", ")}`);
}
