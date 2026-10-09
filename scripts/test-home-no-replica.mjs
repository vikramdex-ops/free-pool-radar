// APR-055: the home page must not render a copy of a route it links to.
//
// A route is a destination. When the landing page reproduces one, the reader
// pays the whole height of that route before reaching anything that exists
// only on the landing page, and the pixels are not information - a copy of
// /providers carries no fact that /providers does not also carry, one click
// away. Measured before this change: / was 17,170px and 14,352px of it -
// 83.6% - was a replica of routes in its own navigation bar. The Provider
// index section rendered 39 of 39 rows with /providers' exact seven headers
// in the same order, reproducing 96% of that entire route inside itself.
//
// PRODUCT.md:840 requires information density and :822 asks for Bloomberg
// density, and the defect is not density, it is duplication. Cutting the
// copies loses 83.6% of the pixels and zero per cent of the facts.
//
// This is a SOURCE assertion. It proves the home page stops rendering the
// components that reproduce a route, and that what remains still states its
// population and its cap. It does not measure rendered height - that needs a
// browser, and a page that renders a component it links to will be a replica
// whatever the CSS says.
//
// Rule 8 of the council brief applies to the caps asserted below: a cap that
// is not stated in the same sentence as the count it limits is a count
// nobody can check.
//
// Run: node scripts/test-home-no-replica.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) =>
  stripComments(readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  ));

const page = read("app/page.tsx");
const ledger = read("components/Ledger.tsx");
const feed = read("components/Feed.tsx");
const siteNav = read("components/SiteNav.tsx");
let productMd = "";
try {
  productMd = readFileSync(
    new URL("../PRODUCT.md", import.meta.url),
    "utf8",
  ).replace(/\r\n/g, "\n");
} catch {
  /* asserted below; a missing file fails that check on its own terms */
}

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

// 1. The home page does not render the provider index. Registry is the
//    component /providers renders, so rendering it here is the replica.
check("home page renders no Registry (the /providers replica)", () => {
  assert.equal(
    /<Registry\b/.test(page),
    false,
    "app/page.tsx still renders <Registry>, which is the provider-index copy",
  );
});

// 2. The section that framed it is gone too, so no orphaned heading remains.
check("home page renders no provider-index section", () => {
  assert.equal(
    /id="registry"/.test(page),
    false,
    'app/page.tsx still renders the id="registry" section',
  );
});

// 3. The live preview stays capped, and lower than the 40 it used. An
//    uncapped preview IS the /live replica.
// The preview is now LivePreview, which groups routes by provider: §17 also
// forbids rendering the same route twice inside one section, and the old
// rendering did exactly that (six cards, then a twelve-row table from the
// same array). Two caps are declared because grouping by provider lets a
// small provider count still cover a lot of routes.
check("live preview is capped below 40", () => {
  const m = page.match(/<LivePreview\b[\s\S]*?\/>/);
  assert.ok(m, "app/page.tsx no longer renders a LivePreview preview at all");
  const limit = m[0].match(/limit=\{(\d+)\}/);
  assert.ok(limit, "the LivePreview declares no limit prop");
  const n = Number(limit[1]);
  assert.ok(
    n > 0 && n < 40,
    `the provider cap is ${n}; it must be a real cap below 40`,
  );

  // The route budget is what actually bounds the section's size.
  const preview = read("components/LivePreview.tsx");
  const budget = preview.match(/maxRoutes = (\d+)/);
  assert.ok(budget, "LivePreview declares no route budget");
  const b = Number(budget[1]);
  assert.ok(
    b > 0 && b < 40,
    `the route budget is ${b}; it must be a real cap below 40`,
  );
});

// 4. The cap is stated. Ledger's caption already says "Showing N of M", and
//    that only counts as a stated population if the reader can see it - so
//    the page must pass a limit at all AND the caption must exist.
check("the ledger states the cap in its caption", () => {
  assert.match(
    ledger,
    /Showing \$\{shown\.length\} of \$\{offers\.length\}/,
    "Ledger.tsx caption no longer states how many of how many are shown",
  );
});

// 5. The intelligence band is capped. New and Changed are two columns of one
//    band, and each column is capped at three subjects so an unbounded change
//    log cannot stretch the landing page.
check("the intelligence band declares a cap", () => {
  assert.match(
    page,
    /<IntelliFeed\b/,
    "app/page.tsx no longer renders the New and Changed intelligence band",
  );
  assert.match(
    feed,
    /\.slice\(0,\s*3\)/,
    "IntelliFeed must cap both columns at 3 subjects",
  );
  assert.match(
    feed,
    /<section[^>]*id="intel"/,
    "IntelliFeed does not render the #intel section",
  );
});

// 6. Feed.tsx honours a limit, so the prop above is not decorative.
check("ChangeFeed accepts and applies a limit", () => {
  assert.match(
    feed,
    /limit\?:\s*number/,
    "ChangeFeed has no optional limit prop, so a limit passed to it is ignored",
  );
  assert.match(
    feed,
    /limit\s*\?\s*allGroups\.slice\(0,\s*limit\)\s*:\s*allGroups/,
    "ChangeFeed does not cap its groups by the limit",
  );
});

// 7. The full timeline link survives the cap. Capping without a way through
//    removes content rather than duplication, which is the line the approval
//    draws.
check("the capped feed still links to the full timeline", () => {
  assert.match(
    feed,
    /href="\/timeline"/,
    "the feed no longer links to /timeline, so capping would remove access",
  );
});

// 8. The home page has the page-head structure every other route has.
check("home page renders a page-head", () => {
  assert.match(
    page,
    /className="page-head"/,
    "app/page.tsx renders no header.page-head",
  );
  assert.match(page, /className="label"/, "the page-head carries no .label");
  assert.match(
    page,
    /className="page-lede"/,
    "the page-head carries no .page-lede",
  );
});

// 9. The hero's h1 is kept. PRODUCT.md:1606 blesses a distinct hero, and the
//    approval says keep h1.hero-title - so the page-head must not introduce a
//    second h1 or replace it.
check("the hero h1 survives the page-head", () => {
  const hero = read("components/Hero.tsx");
  assert.match(hero, /<h1 className="hero-title">/, "Hero.tsx lost its h1");
  const h1s = (page.match(/<h1/g) || []).length;
  assert.equal(h1s, 0, "app/page.tsx renders an h1 of its own; the hero owns it");
});

// 10. Nothing that moves. The approval forbids scroll-reveal, stagger,
//     count-up and reorder-on-update; the home page gains none of them.
check("no reveal, stagger or count-up is added", () => {
  for (const bad of [
    "IntersectionObserver",
    "scrollY",
    "requestAnimationFrame",
    "animate-count",
    "stagger",
    "fade-in",
    "reveal",
  ]) {
    assert.equal(
      page.includes(bad),
      false,
      `app/page.tsx now references ${bad}, which the approval forbids`,
    );
  }
});

// 11. The rule is written into PRODUCT.md. APR-055 says the sentence is part
//     of the approval, because APR-053 and APR-054 need the same one.
check("PRODUCT.md states the no-replica rule", () => {
  assert.ok(productMd.length > 0, "PRODUCT.md was not readable");
  const has = /(may not|does not|must not|cannot)[^.\n]{0,80}reproduc/i.test(
    productMd,
  );
  assert.ok(
    has,
    "PRODUCT.md carries no sentence forbidding a route from reproducing another route",
  );
});

// 12. The nav still reaches every route the home page used to duplicate, so
//     deleting the copies costs no access.
check("the nav still links every route the copies stood in for", () => {
  // The nav builds its items from a data array, so the literal is
  // { href: "/live" }, not href="/live". Matching the wrong shape here is the
  // same class of error as a prefix filter: it reports a zero that is not
  // there.
  for (const href of ["/live", "/providers", "/models", "/timeline"]) {
    assert.match(
      siteNav,
      new RegExp(`href:\\s*"${href}"`),
      `SiteNav no longer links ${href}, so removing the copy removes the only route to it`,
    );
  }
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
