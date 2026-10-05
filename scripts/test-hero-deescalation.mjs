// APR-008: the cinematic revamp de-escalates; it adds no motion, depth or type.
//
// Owner ruling: revamp including making the hero less impressive, with the
// hero's numbers (plus DEC-T12-POPULATION sentences) as the load-bearing
// content. Prism: type-first, keep the three families, contrast floors.
// Hard lines: LIVE pulse untouched, no row moves, no new motion, no new
// fonts, no new dependencies. Perf acceptance lives in
// scripts/perf-scroll.mjs (p95 about 17ms, at most 2 frames over 50ms),
// not here.
//
// Run: node scripts/test-hero-deescalation.mjs (static; needs no server).
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

// 1. Hero display type de-escalated: clamp ceiling at or under 2.5rem
// (was 3.5rem). Smaller shout, same families, same weight.
{
  const m = css.match(/\.hero-title\s*\{[^}]*?font-size:\s*clamp\(([^)]*)\)/);
  const parts = m ? m[1].split(",").map((s) => s.trim()) : [];
  const max = parts[2] ?? null;
  const rem = max ? Number(max.replace("rem", "")) : NaN;
  check(
    "hero title ceiling at most 2.5rem",
    max !== null && Number.isFinite(rem) && rem <= 2.5,
    `clamp max is ${max ?? "unparsed"}`,
  );
}

// 2. No new depth: no drop shadows, text shadows or blend modes anywhere.
for (const prop of ["drop-shadow(", "text-shadow", "mix-blend-mode"]) {
  check(
    `no ${prop} in the stylesheet`,
    !css.includes(prop),
    `${prop} present - depth must pair with an edge, not a blur alone`,
  );
}

// 3. No new motion: the keyframes set is exactly the ratified set.
// A new @keyframes name is a new motion vocabulary entry.
{
  const names = [...css.matchAll(/@keyframes\s+([a-z-]+)/g)].map((m) => m[1]);
  const allowed = new Set([
    "radar-sweep",
    "radar-pulse",
    "tick-blink",
    "settle",
    "radar-in",
  ]);
  const extra = names.filter((n) => !allowed.has(n));
  check(
    "no new keyframes beyond the ratified set",
    extra.length === 0,
    `unexpected keyframes: ${extra.join(", ") || "(none found at all)"}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} revamp guard(s) failed`);
  process.exit(1);
}
console.log("\nAPR-008 static green: de-escalated hero, no new motion or depth");
