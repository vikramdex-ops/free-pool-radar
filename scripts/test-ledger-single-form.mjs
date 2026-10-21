// VIS-061: the card grid and the table must never both render.
//
// Measured before this change: at 1200px the home ledger painted 6 cards AND
// 12 table rows — two renderings of the same twelve offers under one caption.
//
// Honest label: this checks the partition is total, not that the page
// paints. Nobody here can currently measure a fractional viewport, so the
// band between two thresholds closes on arithmetic plus this assertion —
// and this assertion is what is checking it. A test that asserts both
// thresholds are present cannot fail on this defect, because both being
// present IS the failing state; so this test asserts the two media queries
// are logical complements instead.
//
// Run: node scripts/test-ledger-single-form.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const css = read("app/globals.css");
const ledger = stripComments(read("components/Ledger.tsx"));
const providerPage = stripComments(read("app/providers/[slug]/page.tsx"));
const homePage = stripComments(read("app/page.tsx"));
const liveBrowser = stripComments(read("components/LiveBrowser.tsx"));

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

function mediaBlock(cssText, query) {
  const at = cssText.indexOf(query);
  assert.ok(at !== -1, `${query} block is missing from globals.css`);
  let depth = 0;
  for (let i = cssText.indexOf("{", at); i < cssText.length; i++) {
    if (cssText[i] === "{") depth++;
    else if (cssText[i] === "}") {
      depth--;
      if (depth === 0) return cssText.slice(at, i + 1);
    }
  }
  assert.fail(`${query} block never closes`);
}

// The partition is total: exactly one threshold N, stated once, with the
// second rule as its complement. One max-width: N hides the table; one
// not-all-and max-width: N with the same N hides the cards and the narrow
// count. Two integer thresholds (max-width: 900px plus min-width: 901px)
// leave the band (900, 901) unarbitrated, where both forms paint — so any
// min-width second threshold fails here, including min-width: 901px.
check("the two ledger rules are logical complements", () => {
  const queries = [...css.matchAll(/@media\s+([^{\n]+)\{/g)].map((m) => m[1].trim());
  const maxRules = queries.filter((q) => /^\(max-width:\s*(\d+)px\)$/.test(q));
  assert.equal(maxRules.length, 1, `expected one max-width rule, found ${maxRules.length}`);
  const n = maxRules[0].match(/(\d+)px/)[1];
  const complements = queries.filter(
    (q) => q === `not all and (max-width: ${n}px)`,
  );
  assert.equal(complements.length, 1, `expected one complement rule for ${n}px, found ${complements.length}`);
  // Other breakpoints in this file use min-width for unrelated components;
  // what is forbidden is a min-width second threshold for THIS breakpoint,
  // which re-opens the unarbitrated band (or, at the same N, a width where
  // nothing paints).
  const secondIntegers = queries.filter((q) => /\(min-width:\s*90[01]px\)/.test(q));
  assert.deepEqual(
    secondIntegers,
    [],
    "a min-width second threshold leaves an unarbitrated band",
  );
});

// The table hides inside the max-width rule and the cards hide inside the
// complement — the complement alone proves nothing unless each rule hides
// its own form.
check("each rule hides its own form", () => {
  const narrow = mediaBlock(css, "@media (max-width: 900px)");
  assert.match(narrow, /\.ledger-table\s*\{\s*display:\s*none;\s*\}/);
  const wide = mediaBlock(css, "@media not all and (max-width: 900px)");
  assert.match(wide, /\.ledger-cards\s*\{\s*display:\s*none;\s*\}/);
  assert.match(wide, /\.ledger-narrow-count\s*\{\s*display:\s*none;\s*\}/);
});

// 4. The narrow count lives outside the hidden table, so it survives it.
check("the narrow count renders outside the table", () => {
  assert.match(ledger, /ledger-narrow-count/);
  assert.ok(
    ledger.indexOf("ledger-narrow-count") < ledger.indexOf("tbl-wrap ledger-table"),
    "the narrow count renders inside (or after) the hidden table",
  );
});

// 5. Exactly the page with no other surviving count opts in: the provider
//    page. Home has its capped-preview line, /live has its filter count.
check("only the provider page opts into the narrow count", () => {
  assert.match(providerPage, /<OfferLedger\b[\s\S]*?narrowCount/);
  assert.equal(
    /narrowCount/.test(homePage),
    false,
    "home opts into narrowCount although its preview line already survives narrow",
  );
  assert.equal(
    /narrowCount/.test(liveBrowser),
    false,
    "/live opts into narrowCount although its filter count already survives narrow",
  );
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nledger renders one form per viewport, with its count");
