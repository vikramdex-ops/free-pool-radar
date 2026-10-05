// VIS-047: ink and surface must stay in phase on a theme switch.
//
// color is inherited and background-color is not. body faded both over 0.35s
// while the 992 elements painting an opaque background snapped on frame one,
// so /live text sat at 1.05-1.24:1 contrast for 44-125ms per flip, in both
// directions. Shortening the body fade narrows the window; it does not remove
// it, because the split is that `color` transitions and `background-color`
// never reaches the surfaces at all.
//
// The fix: every rule that already transitions ink on interaction must carry its
// surface with it, so no element can end up with new ink on an old background.
//
// HONEST LIMIT OF THIS TEST, stated here so no one mistakes it for the
// acceptance criterion. This is a static source assertion. It proves the
// declarations exist; it cannot prove contrast, because it never renders. The
// acceptance criterion for VIS-047 is Vision's per-frame contrast measurement
// on a real flip with no frame below 4.5:1, and that is NOT yet met. A future
// reader must not treat a green run here as VIS-047 being fixed.
//
// Run: node scripts/test-ink-surface-phase.mjs (static; needs no server).
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

let failures = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

// One shared duration token, so a theme duration cannot drift between rules
// (Prism, cycle 2026-10-05T04: more declarations risk drift).
const token = css.match(/--t-dur:\s*([\d.]+s)/);
check(
  "a single --t-dur token exists",
  Boolean(token),
  "no --t-dur declaration in :root",
);
if (token) {
  const secs = parseFloat(token[1]);
  // PRODUCT.md:1677-1679 - 0.15s to 0.18s, because at that duration the reader
  // registers a response rather than an event.
  check(
    `--t-dur is inside the 0.15-0.18s vocabulary (${token[1]})`,
    secs >= 0.15 && secs <= 0.18,
    `--t-dur is ${token[1]}, outside PRODUCT.md:1677-1679`,
  );
}

// Every rule that transitions ink on interaction must carry its surface.
const RULES = [".link", ".btn", ".filter", ".nav-link", ".theme-toggle"];
for (const sel of RULES) {
  const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`${escaped}\\s*\\{[^}]*?transition:([^;]*);`));
  const transition = m ? m[1] : null;
  const ok =
    transition !== null &&
    /background-color/.test(transition) &&
    /var\(--t-dur\)|0\.15s/.test(transition);
  check(
    `${sel} transitions surface with ink`,
    ok,
    transition === null
      ? "no transition declaration found"
      : `transition is "${transition.trim()}" - ink moves without its surface`,
  );
}

// The glyph was the only other violator of the duration vocabulary, at 0.25s.
const glyph = css.match(/\.theme-glyph\s+svg\s*\{[^}]*?transition:\s*([^;]*);/);
check(
  ".theme-glyph svg is inside the vocabulary",
  Boolean(glyph) && /var\(--t-dur\)|0\.1[5-8]s/.test(glyph[1]),
  glyph ? `transition is "${glyph[1]}"` : "no transition on .theme-glyph svg",
);

// body must no longer carry 0.35s, and must not be described as the fix.
const body = css.match(/body\s*\{[^}]*?transition:\s*([^;]*);/);
check(
  "body theme duration is inside the vocabulary",
  Boolean(body) && !/0\.3\d+s/.test(body[1]),
  body ? `body transition still declares "${body[1]}"` : "no body transition found",
);

// The toggle's label swaps DARK (4 chars) for LIGHT (5 chars). With the box
// pinned on the right by position:fixed, an unconstrained box moves its LEFT
// edge. A min-width is the floor that stops it.
const toggle = css.match(/\.theme-toggle\s*\{[^}]*\}/);
check(
  ".theme-toggle has a width floor for the label swap",
  Boolean(toggle) && /min-width/.test(toggle[0]),
  toggle ? "no min-width declared" : ".theme-toggle rule not found",
);

// Reduced motion must remain untouched. Never bundle a duration change with
// this guard: it is correct as written and neutrals every transition.
// Matched from the media query to the declaration rather than by nesting
// braces - the block contains an earlier rule (html) whose closing brace ends
// any naive brace-delimited match before the universal selector is reached.
const reducedBlock = (() => {
  const at = css.indexOf("@media (prefers-reduced-motion: reduce)");
  if (at === -1) return null;
  // The universal-selector rule is the last one before the block closes.
  const sel = css.indexOf("*, *::before, *::after", at);
  if (sel === -1) return null;
  const close = css.indexOf("}", sel);
  return close === -1 ? null : css.slice(sel, close);
})();
check(
  "prefers-reduced-motion guard is intact",
  Boolean(reducedBlock) &&
    /transition-duration:\s*0\.001ms\s*!important/.test(reducedBlock),
  reducedBlock
    ? "reduced-motion block no longer neutralises transition-duration"
    : "no prefers-reduced-motion block found",
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(
  "\nink and surface transition together (static check only - VIS-047 acceptance is a per-frame contrast measurement, not this)",
);