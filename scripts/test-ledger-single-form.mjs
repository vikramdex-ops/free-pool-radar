// VIS-061: the card grid and the table must never both render.
//
// Measured before this change: at 1200px the home ledger painted 6 cards AND
// 12 table rows — two renderings of the same twelve offers under one caption.
// Below 900px the cards are the fallback and the table hides; at and above
// 900px the table is the list and the cards hide.
//
// This is a SOURCE assertion: it proves the CSS keeps the two forms mutually
// exclusive, that the narrow count lives outside the hidden table, and that
// exactly the page with no other surviving count opts into it. It does not
// measure painted pixels — that needs a browser, and a stylesheet that shows
// both forms at one width will paint both whatever the TSX says.
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

// 1. Below 900px the table hides and the cards survive.
check("narrow hides the table, keeps the cards", () => {
  const narrow = mediaBlock(css, "@media (max-width: 900px)");
  assert.match(narrow, /\.ledger-table\s*\{\s*display:\s*none;\s*\}/);
  assert.equal(
    /\.ledger-cards\s*\{\s*display:\s*none/.test(narrow),
    false,
    "the narrow block hides the cards too, leaving no list at all",
  );
});

// 2. At and above 900px the cards hide — the half that was missing, and the
//    whole defect.
check("wide hides the cards", () => {
  const wide = mediaBlock(css, "@media (min-width: 901px)");
  assert.match(wide, /\.ledger-cards\s*\{\s*display:\s*none;\s*\}/);
});

// 3. The narrow count hides where the caption is visible, so the number is
//    never stated twice.
check("the narrow count hides where the caption shows", () => {
  const wide = mediaBlock(css, "@media (min-width: 901px)");
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
