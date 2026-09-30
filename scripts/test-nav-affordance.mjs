// PRI-001: the mobile nav strip hides its scrollbar, so clipped destinations
// need a visible cue and the strip must be keyboard-scrollable.
// Run: node scripts/test-nav-affordance.mjs (static; needs no server).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const nav = fs.readFileSync(
  path.join(root, "components", "SiteNav.tsx"),
  "utf8",
);
const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");

// The strip is a keyboard-operable scroll region (WCAG 2.1.1): focusable,
// named, and explicitly a region. Before the fix the ul had no tabindex,
// role or label, so keyboard users could not scroll it at all.
for (const needle of [
  "tabIndex={0}",
  'role="region"',
  'aria-label="Primary destinations"',
  "nav-scroll",
]) {
  assert.ok(nav.includes(needle), `SiteNav.tsx must contain ${needle}`);
}
console.log("nav focusability: ok");

// All eight destinations stay, in the same order. The nav must not be
// reordered or trimmed to fit.
const hrefs = [...nav.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
assert.deepEqual(hrefs, [
  "/live",
  "/events",
  "/providers",
  "/models",
  "/compare",
  "/timeline",
  "/search",
  "/methodology",
]);
console.log("nav destinations: ok (8, order unchanged)");

// The cue is an edge fade on the neutral sheet surface. State colours
// (invariant 5: green live, amber upcoming, red ended, grey stale) must
// not be reused for it; blue (--t-info) is neutral and allowed.
const cueBlock = css.slice(css.indexOf(".nav-scroll::after"));
assert.ok(
  cueBlock.includes("linear-gradient") && cueBlock.includes("--t-sheet"),
  "nav cue must be a fade on the neutral sheet surface",
);
for (const banned of ["--t-live", "--t-upcoming", "--t-ended", "--t-stale"]) {
  const block = cueBlock.slice(0, cueBlock.indexOf("}", cueBlock.indexOf("{")));
  assert.ok(
    !block.includes(banned),
    `nav cue must not reuse state colour ${banned}`,
  );
}
assert.ok(
  css.includes(".nav-list:focus-visible"),
  "nav strip needs a visible focus indicator",
);
console.log("nav cue: ok (neutral fade, focus style, no state colours)");

// The regression is wired into the existing harness so the next audit
// catches it: verify.mjs asserts cue presence + keyboard reachability.
const verify = fs.readFileSync(
  path.join(root, "scripts", "verify.mjs"),
  "utf8",
);
assert.ok(
  verify.includes("nav-list") && verify.includes("keyboard"),
  "scripts/verify.mjs must assert the nav cue + keyboard reachability",
);
console.log("harness wiring: ok");

console.log("nav-affordance: ok");
