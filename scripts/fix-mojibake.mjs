/* Repairs UTF-8 mojibake with exact, targeted replacements.
   Reading a UTF-8 file as Windows-1252 and writing it back as UTF-8 expands each
   multi-byte character into several. The result renders as garbage.

   A whole-file decode was the obvious approach and it is wrong. These files are
   mixed: some characters are intact and others are damaged, and the damaged
   bytes cannot be distinguished from the intact ones by position. Decoding the
   whole file therefore corrupts what was already correct.

   Each replacement below is an exact damaged sequence with a known original.
   The clean form of every one of these characters also occurs elsewhere in the
   tree, so there is no guesswork about what they should be.

   Run scripts/list-chars.mjs first to see what is present. */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.argv[2] ?? ".";
const EXTS = new Set([".ts", ".tsx", ".md", ".sql", ".css"]);
const SKIP = new Set(["node_modules", ".next", ".git", ".vercel", ".review"]);

/** Damaged sequence -> the character it was meant to be. */
const REPAIRS = [
  ["Â§", "§"], // Â§  -> §
  ["Â·", "·"], // Â·  -> ·
  ["Â—", "—"], // Â—  -> —
  ["Â'", "’"], // Â'  -> ’
  ["Â“", "“"], // Â“  -> “
  ["Â”", "”"], // Â”  -> ”
  ["â†’", "→"], // â†'  -> →
  ["â€”", "—"], // â€"  -> —
  ["â€“", "–"], // â€'  -> –
  ["â€¦", "…"], // â€¦  -> …
  ["â€¢", "•"], // â€¢  -> •
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

let total = 0;
for (const file of walk(ROOT)) {
  const original = readFileSync(file, "utf8");
  let text = original;
  let hits = 0;
  for (const [bad, good] of REPAIRS) {
    if (!text.includes(bad)) continue;
    const n = text.split(bad).length - 1;
    text = text.split(bad).join(good);
    hits += n;
  }
  if (hits === 0) continue;
  writeFileSync(file, text, "utf8");
  total += hits;
  console.log(`  ${relative(ROOT, file)}: ${hits} replacement(s)`);
}

console.log(total === 0 ? "nothing to repair" : `repaired ${total} sequence(s)`);
