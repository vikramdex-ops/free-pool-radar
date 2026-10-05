// APR-059: every hero figure states its population and an as-of date.
//
// A count without the set it was drawn from cannot be checked and goes stale
// silently. Measured before this change: the hero printed a distinct model-id
// count beside a /models page reporting rows and distinct ids over a different
// population, and the reader had no way to tell which set a number came from.
//
// This is a SOURCE assertion: it proves the population sentence is rendered
// from the same variables the figure is rendered from, so the two cannot drift
// apart in code. It does not prove the sentences are true on any given day -
// that needs the served HTML, and a figure whose population is computed from
// the same array as the figure cannot be internally inconsistent anyway.
//
// Rule 8 of the council brief applies: the population is part of the claim, not
// a caption beside it.
//
// Run: node scripts/test-hero-populations.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const statsRaw = readFileSync(
  new URL("../components/RadarStats.tsx", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
// Comments are stripped before asserting on literals: a date inside a comment
// explaining why a date is required is not a hard-coded date.
const stats = stripComments(statsRaw);

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

// 1. Every stat entry carries a population. Counting the entries that have a
//    `p:` field and comparing against the number of rendered figures is the
//    only assertion that catches someone adding a fifth figure without one.
// Each figure is one object literal in the `stats` array. Extract them by brace
// matching rather than by splitting on a guessed separator or matching
// v:/l:/p: independently - a figure may declare them in any order, and a
// per-key regex cannot tell whether the p: it found belongs to THIS figure or
// the next one. Brace counting is the only parse here that cannot be fooled by
// formatting.
function extractObjects(src, startMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) return [];
  const open = src.indexOf("[", start);
  let depth = 0;
  let inStr = false;
  let quote = "";
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === "`" || c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i).split("\n").slice(1).join("\n");
    }
  }
  return [];
}

const arrayBody = extractObjects(stats, "const stats =");
// Top-level object literals only: a `{` nested deeper than the array's first
// level is a nested value, not a figure.
const objects = [];
{
  // Template literals are skipped while counting. `${num(...)}` inside a
  // backtick string contains real braces, and counting them makes every
  // figure that interpolates a value look like it has a nested object - which
  // is how "Sources responding" lost its own population in the first place.
  let depth = 0;
  let buf = "";
  let inStr = false;
  let quote = "";
  for (let i = 0; i < arrayBody.length; i++) {
    const ch = arrayBody[i];
    if (inStr) {
      if (depth > 0) buf += ch;
      if (ch === "\\") {
        if (depth > 0) buf += arrayBody[i + 1] ?? "";
        i++;
      } else if (ch === quote) {
        inStr = false;
      }
      continue;
    }
    if (ch === "`" || ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
      if (depth > 0) buf += ch;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) buf = "";
      depth++;
      buf += ch;
    } else if (ch === "}") {
      depth--;
      if (depth > 0) buf += ch;
      if (depth === 0) objects.push(buf);
    } else if (depth > 0) {
      buf += ch;
    }
  }
}
const figures = objects.filter((chunk) => /\bl:\s*"/.test(chunk));

check(
  "hero declares its figures",
  () => assert.ok(figures.length >= 4, `only found ${figures.length} figure objects`),
);
check(
  "every figure has a population sentence",
  () => {
    const withoutPop = figures
      .filter((chunk) => !/\bp:\s*["`]/.test(chunk))
      .map((chunk) => (chunk.match(/\bl:\s*"([^"]+)"/) ?? [, "?"])[1]);
    assert.deepEqual(withoutPop, [], "figures with no population sentence");
  },
);
check(
  "every figure's value and label live in the same object as its population",
  () => {
    const strays = figures.filter((chunk) => (chunk.match(/\bp:\s*["`]/g) ?? []).length > 1);
    assert.deepEqual(strays.map((c) => (c.match(/\bl:\s*"([^"]+)"/) ?? [, "?"])[1]), [], "an object declares two populations");
  },
);

// 2. The population sentences must be built from real counts, not literals. A
//    population written as a hard-coded number is a caption that drifts.
check(
  "populations are computed from the data, not hard-coded",
  () => {
    const pops = [...stats.matchAll(/\bp:\s*(?:"([^"]*)"|`([^`]*)`)/g)].map((m) => m[1] ?? m[2]);
    assert.ok(pops.length >= 4, `only ${pops.length} population strings`);
    for (const p of pops) {
      // A population sentence that mentions a number must get it from num().
      assert.ok(
        /\$\{num\(/.test(p) || !/\d/.test(p),
        `population contains a bare digit instead of num(): ${p}`,
      );
    }
  },
);

// 3. An as-of line exists, because a figure with no date cannot be stale-checked.
check(
  "an as-of date is rendered",
  () => assert.match(stats, /last sweep \{\{?asOf|today|asOf\}/),
);

// 4. The as-of value is derived at request time, not baked into the source.
check(
  "as-of is computed at request time",
  () => {
    assert.match(stats, /new Date\(\)/);
    assert.ok(
      !/\d{4}-\d{2}-\d{2}/.test(stats),
      "a literal date is baked into the component",
    );
  },
);

// The required-prop check must look for the prop being passed, in either form:
// `modelIds,` (shorthand) or `modelIds: something`. A shorthand pass is the
// common case and a regex demanding a colon reports a false failure.
check(
  "the page passes every population prop the component requires",
  () => {
    const required = [...stats.matchAll(/^\s{2}(\w+):\s*number;$/gm)].map((m) => m[1]);
    assert.ok(required.length >= 5, `only found ${required.length} required number props`);
    const at = page.indexOf("stats={{");
    const passBlock = at === -1 ? "" : page.slice(at, at + 500);
    assert.ok(passBlock !== "", "page no longer passes a stats={{ ... }} object");
    const missing = required.filter(
      (prop) => !new RegExp(`(^|[\\s{,])${prop}\\s*[,:}]`, "m").test(passBlock),
    );
    assert.deepEqual(missing, [], "props the page does not pass");
  },
);

// 6. CEO-R01: the distinct-id count and the row count must share one
//    population — the rows carrying a model id. Pairing the distinct ids with
//    offers.length compared two different populations (rows with and without a
//    model id), so the page must derive both from model_id_text and pass the
//    filtered count, never offers.length.
check(
  "distinct ids and row count share one population",
  () => {
    assert.match(page, /const modelIds = new Set\(\s*\n?\s*offers\.map/);
    assert.match(page, /modelRows:\s*modelRowsWithId/);
    assert.match(
      page,
      /modelRowsWithId = offers\.filter\(\(o\) => Boolean\(o\.model_id_text\)\)/,
    );
    assert.equal(
      /modelRows:\s*offers\.length/.test(page),
      false,
      "modelRows still uses the whole-row denominator",
    );
  },
);

// 7. The withdrawn figure must be a subset statement, not a bare count: "ended
//    routes, kept on the record of N live" is honest about what the denominator
//    is.
check(
  "the withdrawn figure states its denominator",
  () => assert.match(stats, /kept on the record of/),
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nhero figures state their population and an as-of date");


