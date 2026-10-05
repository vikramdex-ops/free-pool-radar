// ARC-039: ink and surface must stay in phase on a theme switch.
//
// color is inherited and background-color is not: body fades both over
// 0.35s while the 992 elements painting opaque backgrounds snap, so text
// sits at 1.05-1.24:1 contrast for 80-125ms per flip (measured by Vision,
// mechanism verified by Stark). Shortening the body fade only shortens the
// window. The fix: the rules that already transition ink at 0.15s must
// transition their surface too, so each element's ink and background move
// together instead of against each other.
//
// Run: node scripts/test-ink-surface-phase.mjs (static; needs no server).
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

// Every rule that transitions ink on interaction must carry its surface
// with it, so a theme flip cannot put new ink on an old background.
const RULES = [".link", ".btn", ".filter", ".nav-link", ".theme-toggle"];

let failures = 0;
for (const sel of RULES) {
  const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`${escaped}\\s*\\{[^}]*?transition:([^;]*);`));
  const transition = m ? m[1] : null;
  const ok =
    transition !== null &&
    /background-color/.test(transition) &&
    /0\.15s/.test(transition);
  if (ok) {
    console.log(`ok ${sel} transitions surface with ink (${transition.trim()})`);
  } else {
    failures++;
    console.error(
      `FAIL ${sel}: transition is ${transition === null ? "missing" : `"${transition.trim()}"`} - ink moves without its surface`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} rule(s) move ink without their surface`);
  process.exit(1);
}
console.log("\nARC-039 green: ink and surface transition together");
