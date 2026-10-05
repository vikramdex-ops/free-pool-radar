// APR-006: the responsive rule, enforced per element.
//
// Rule (adopted): a route either ADAPTS or is WIDTH-INVARIANT, and if it is
// width-invariant it must not remove content. Chrome must never be the thing
// removed. Concretely for evidence: every offer surface must keep its
// citation record reachable at every width. Anchors present in the DOM do
// not count -- visibility at the narrowest painted width counts.
//
// The failure this catches: /live renders its table (with internal
// /evidence/[id] links) inside .tbl-wrap, which globals.css hides below
// 900px, while the replacement card form linked straight out to the raw
// provider URL. At 390px all 148 internal anchors existed and zero were
// visible. A per-element visibility test is the only kind that sees it:
// document-level overflow checks pass because the page itself never scrolls.
//
// Run: node scripts/test-responsive-evidence.mjs (static; needs no server).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ledger = fs.readFileSync(
  path.join(root, "components", "Ledger.tsx"),
  "utf8",
);

// The card foot is the only offer surface that renders below 900px, so it
// must route through the citation record exactly like the table row does
// (Ledger table: <EvidenceLink offerId={o.id} />). Before the fix the card
// linked straight to the raw provider URL, which is a different class of
// destination under an identical word.
assert.ok(
  ledger.includes("offerId={offer.id}"),
  "OfferCard foot must route through /evidence/[id] via offerId={offer.id}",
);
console.log("card evidence routing: ok (internal citation record)");

// And the bypass must be gone: an external href on the card foot renders
// zero internal anchors at phone widths while the table's 148 sit hidden.
assert.ok(
  !ledger.includes("href={offer.official_evidence_url}"),
  "OfferCard foot must not link straight to the raw provider URL",
);
console.log("card evidence bypass: ok (no external href on card foot)");

// The table row is the reference implementation. If it ever stops routing
// through the record, the card and the table disagree again.
assert.ok(
  ledger.includes("offerId={o.id}"),
  "Ledger table row must keep routing through /evidence/[id]",
);
console.log("table evidence routing: ok (reference intact)");

console.log("responsive-evidence: ok");
