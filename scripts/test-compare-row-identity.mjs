// APR-019: /compare dimension labels must stay visible while columns scroll.
//
// th.label is position static and travels out of the viewport (33px to
// -267px at 1024px, 122px to -179px at 1440px), so values scroll out from
// under a dimension name that has left - orphan facts. The fix exists in the
// stylesheet for /live (.tbl-live .sticky-col); /compare reuses the rule
// shape under its own scope so APR-054's transpose can absorb it later.
//
// Run: node scripts/test-compare-row-identity.mjs (static; needs no server).
import { readFileSync } from "node:fs";

const page = readFileSync(
  new URL("../app/compare/page.tsx", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");
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

// 1. The compare table opts into the sticky-column scope (not tbl-live,
// whose column widths and padding belong to the ledger alone).
check(
  "compare table carries tbl-compare scope",
  /<table className="tbl tbl-compare"/.test(page),
  "table must read className=\"tbl tbl-compare\"",
);

// 2. Every row-header th carries sticky-col alongside its label class.
const rowHeaders = page.match(/<th scope="row"[^>]*>/g) ?? [];
const stickyHeaders = page.match(/<th scope="row"[^>]*sticky-col[^>]*>/g) ?? [];
check(
  "every dimension th is sticky",
  rowHeaders.length > 0 && stickyHeaders.length === rowHeaders.length,
  `${stickyHeaders.length}/${rowHeaders.length} row headers carry sticky-col`,
);

// 3. The corner header cell is sticky too (thead variant covers it).
check(
  "corner Dimension th is sticky",
  /<th scope="col"[^>]*sticky-col[^>]*>Dimension/.test(page),
  "Dimension corner cell must carry sticky-col",
);

// 4. The stylesheet binds position:sticky left:0 under the compare scope.
check(
  "tbl-compare sticky rule pins left",
  /\.tbl-compare \.sticky-col\s*\{[^}]*position:\s*sticky[^}]*left:\s*0/.test(css),
  ".tbl-compare .sticky-col must declare position:sticky with left:0",
);
check(
  "thead sticky variant exists for compare",
  /\.tbl-compare thead \.sticky-col/.test(css),
  ".tbl-compare thead .sticky-col variant missing (corner cell layering)",
);

// 5. Scope guard: no bare .tbl .sticky-col that would leak onto tables
// whose columns were never measured for a sticky first column.
const bare = css.match(/^[ \t]*\.tbl \.sticky-col\b/m);
check(
  "no unscoped tbl sticky rule",
  bare === null,
  "a bare .tbl .sticky-col rule would attach to unmeasured tables",
);

if (failures > 0) {
  console.error(`\n${failures} row-identity assertion(s) failed`);
  process.exit(1);
}
console.log("\nAPR-019 green: dimension labels stay visible while columns scroll");
