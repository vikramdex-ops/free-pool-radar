// Slice 1 (SAFE): the sweep tells the truth; VIS-066 fresh; APR-031 rings.
//
// Three defects, one hero:
//  1. VIS-066 — the first stat tile pairs a distinct-id numerator with a
//     whole-row denominator. Numerator and denominator must come off the
//     same array, hard-coding neither, and the label must name both
//     populations.
//  2. SAFE — `radar-sweep` runs a 7s constant while real sweeps land ~5h
//     apart (~988x overstatement). The period must derive from the measured
//     sweep interval already on the page, not from a constant.
//  3. APR-031 — the four range rings encode pool scale as radius rank.
//     They are deleted, not restyled.
//
// RED-FIRST: every defect check below fails on the pre-change tree and
// passes after. It asserts wiring, not paint — necessary, not sufficient;
// paint is observed on the served page at both widths.
//
// Run: node scripts/test-hero-safe.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const css = read("app/globals.css");
const page = stripComments(read("app/page.tsx"));
const hero = stripComments(read("components/Hero.tsx"));
const stats = stripComments(read("components/RadarStats.tsx"));
const dial = stripComments(read("components/RadarDial.tsx"));

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

// 1. VIS-066, fresh: numerator and denominator off one array.
check("hero counts distinct ids and their rows off one array", () => {
  assert.match(
    page,
    /offers\.filter\(\(o\) => Boolean\(o\.model_id_text\)\)/,
    "page does not derive the counted population from model_id_text",
  );
  assert.equal(
    /modelRows:\s*offers\.length/.test(page),
    false,
    "modelRows still uses the whole-row denominator",
  );
});

// 2. VIS-066, fresh: the label names the counted population and the total.
check("the tile names the population it counts and the total", () => {
  assert.match(stats, /\$\{num\(modelRows\)\}/, "no computed denominator in the sentence");
  assert.match(stats, /\$\{num\(liveRoutes\)\}/, "no computed total in the sentence");
  assert.match(stats, /carrying a model id/, "the counted population is unnamed");
  assert.match(stats, /of \$\{num\(liveRoutes\)\} live routes/, "the total is unnamed");
});

// 2b. CEO-R31: tile 2 states a cardless count under a total-provider count.
//    "Cardless" and "with a live route" are not the same population. The
//    denominator must be the providers with a live route drawn off the same
//    array as the numerator — never the whole provider registry.
check("cardless denominator is providers with a live route, not the registry", () => {
  assert.equal(
    /liveProviders:\s*providers\.length/.test(page),
    false,
    "liveProviders still counts the whole registry",
  );
  assert.match(
    page,
    /liveProviders/,
    "no live-route provider denominator is passed at all",
  );
});

// 3. SAFE: no constant sweep period.
check("the sweep period is not a constant", () => {
  assert.equal(
    /animation:\s*radar-sweep\s+7s/.test(css),
    false,
    "the 7s constant still drives the sweep",
  );
  assert.match(css, /var\(--sweep-period/, "no CSS variable carries the period");
});

// 4. SAFE: the period is threaded from the measured interval on the page.
check("the period derives from last/next sweep on the page", () => {
  assert.match(page, /last_sweep_at/, "page does not read the last sweep");
  assert.match(page, /next_sweep_at/, "page does not read the next sweep");
  assert.match(hero, /--sweep-period/, "Hero does not set the sweep variable");
});

// 5. APR-031: the range rings are gone, not restyled.
check("no range rings encode pool scale", () => {
  assert.equal(
    /\[0\.34,\s*0\.56,\s*0\.78,\s*1\]/.test(dial),
    false,
    "the four ring fractions still render",
  );
  assert.equal(
    /Range rings/.test(dial),
    false,
    "a range-ring comment survives its deletion",
  );
});

// Guards: what Slice 1 must not move.
check("the LIVE dot keeps its pulse", () => {
  assert.match(hero, /dot-live tick/, "the hero eyebrow lost the live dot");
});

check("reduced motion still collapses every animation", () => {
  assert.match(
    css,
    /prefers-reduced-motion/,
    "no reduced-motion blanket covers the hero",
  );
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nslice 1: truthful sweep, named populations, no rings");
