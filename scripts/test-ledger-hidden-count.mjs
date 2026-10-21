// VIS-062: the "N further free routes not shown here" sentence must describe
// what the reader can actually see, on every viewport.
//
// Measured on the deployed production URL at 390px, cache-busted 2026-10-05:
// 6 cards painted, sentence said "136 further free routes not shown here",
// link said "See all 148". 6 + 136 = 142. The page said 148. The gap was 6,
// which is the size of components/Ledger.tsx:67's shown.slice(0, 6) — the
// sentence is computed from `shown` (12) while the narrow form painted 6.
//
// The general rule this enforces: the count of things NOT shown must be
// derived from the same array the visible form renders from. Any second
// truncation between them re-opens the gap. So this test does not hard-code
// 6; it forbids a second narrowing of `shown` anywhere in the component.
//
// Honesty label: this is a static source assertion. It cannot measure paint and
// does not claim to. It proves the arithmetic has one input, which is the part
// that broke.
//
// Run: node scripts/test-ledger-hidden-count.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const ledger = stripComments(read("components/Ledger.tsx"));

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

// The invariant the caption and the sentence both rest on: there is exactly
// one narrowing of `offers`, into `shown`, and `hidden` is measured against
// `shown` — never against a differently narrowed array.
check("offers is narrowed exactly once, into shown", () => {
  const narrowings = [...ledger.matchAll(/offers\s*\.\s*(slice|splice)\s*\(/g)];
  assert.equal(
    narrowings.length,
    1,
    `offers is narrowed ${narrowings.length} times; every extra narrowing desynchronises the "further" count from what paints`,
  );
});

check("hidden is measured against shown, not against offers", () => {
  assert.match(
    ledger,
    /const hidden = offers\.length - shown\.length;/,
    "hidden must be offers.length minus what shown holds, or the sentence overstates by the difference",
  );
});

check("shown is never narrowed again after it is built", () => {
  const offenders = [...ledger.matchAll(/shown\s*\.\s*(slice|splice|shift|filter)\s*\(/g)];
  assert.deepEqual(
    offenders.map((m) => m[0]),
    [],
    "a second narrowing of shown (this is the shown.slice(0, 6) that caused VIS-062) leaves the count describing a different array than the one painted",
  );
});

// The sentence and the link must be computed from the same two numbers. If
// either were computed from `offers` directly while the other came from
// `shown`, the page would state two totals that differ.
check("the sentence and the link state one total, from shown", () => {
  const sentence = ledger.match(/\{num\(hidden\)\} further free route/);
  assert.ok(sentence, "the 'further free routes' sentence no longer prints num(hidden)");
  const link = ledger.match(/See all \{([^}]+)\}/);
  assert.ok(link, "the 'See all N' link is gone");
  assert.equal(
    link[1].trim(),
    "offers.length",
    "the link must state the full population (offers.length); stating shown.length would promise a page that does not exist",
  );
});

// The count that pairs with the sentence is the caption's own denominator. If
// the caption counted something else the two would not close either.
check("the caption denominator is the same population as the link", () => {
  assert.match(
    ledger,
    /Showing \$\{shown\.length\} of \$\{offers\.length\} currently usable free routes/,
    "the caption must count shown against offers, the same pair the sentence uses",
  );
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nledger counts one array, so the sentence, caption and link close");
