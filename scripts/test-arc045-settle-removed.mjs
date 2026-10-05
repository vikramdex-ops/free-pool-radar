#!/usr/bin/env node
// ARC-045 guardrail: the CHANGE ARRIVAL "settle" wash is deleted, and no
// reference to it survives anywhere. Two failure modes this asserts against:
//   1. the rule comes back into the stylesheet, or
//   2. a selector or test keeps naming .settle (the dead-reference defect
//      ARC-045's closure exists to prevent).
// Also asserts the reduced-motion check cannot pass on an empty set, which is
// the generalisable half: [].every() === true.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
// scripts/ is excluded from the class-reference sweep: acceptance.mjs is
// checked explicitly below, and unrelated scripts use "settles" in prose about
// networkidle. Sweeping them with a class pattern produced false hits.
const SCAN_DIRS = ["app", "components", "lib", "supabase"];
const SCAN_EXT = /\.(tsx?|css|mjs|js|json)$/;

const failures = [];
const ok = [];
function check(name, pass, detail = "") {
  if (pass) ok.push(name);
  else failures.push(`${name}${detail ? " — " + detail : ""}`);
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === ".git") continue;
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(e)) out.push(full);
  }
  return out;
}

// --- 1. the rule and its consumers are gone -------------------------------
const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
check("scan found source files", files.length > 20, `only ${files.length} files`);

const settleHits = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  // Ignore this file's own guardrail strings.
  const rel = relative(ROOT, f).replace(/\\/g, "/");
  if (rel === "scripts/test-arc045-settle-removed.mjs") continue;
  // Match .settle as a CSS class / keyframe name only. A bare \bsettle\b also
  // matches prose ("the network does not settle on networkidle") and comments,
  // which is the wrong instrument for "is there a surviving reference".
  const asClass = /\.settle\b|@keyframes\s+settle\b|["'`]settle\b/;
  // Strip comments block-aware before scanning, keeping a 1:1 line map so a
  // reported location points at the real file line. A comment that NAMES the
  // deleted rule is documentation we want to keep, and ARC-045's comment spans
  // several lines, so a per-line strip would miss its continuation lines.
  const lines = src.split("\n");
  let inBlock = false;
  const codeLines = lines.map((line) => {
    let code = line;
    if (inBlock) {
      const end = code.indexOf("*/");
      if (end === -1) return "";
      code = code.slice(end + 2);
      inBlock = false;
    }
    while (true) {
      const start = code.indexOf("/*");
      if (start === -1) break;
      const end = code.indexOf("*/", start + 2);
      if (end === -1) {
        code = code.slice(0, start);
        inBlock = true;
        break;
      }
      code = code.slice(0, start) + code.slice(end + 2);
    }
    code = code.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
    return code;
  });
  codeLines.forEach((code, i) => {
    if (asClass.test(code)) settleHits.push(`${rel}:${i + 1}`);
  });
}
check(
  "no surviving .settle reference in app/, components/, lib/, scripts/, supabase/",
  settleHits.length === 0,
  settleHits.join(", "),
);

const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
check("@keyframes settle removed from globals.css", !/@keyframes\s+settle/.test(css));
check(".settle rule removed from globals.css", !/^\s*\.settle\s*\{/m.test(css));

// --- 2. the four surviving motion classes still exist ---------------------
// .radar-in is applied via a grouped selector (the readout rule at :903), so
// asserting a literal ".radar-in {" selector would be the wrong instrument.
// Assert the keyframes and the animation that invokes it instead.
for (const cls of [".tick", ".radar-sweep", ".radar-pulse"]) {
  check(`${cls} still declared in globals.css`, new RegExp(`\\${cls}\\s*\\{`).test(css));
}
check("@keyframes radar-in still declared", /@keyframes\s+radar-in\s*\{/.test(css));
check("radar-in animation still invoked", /animation:\s*radar-in\s/.test(css));

// --- 3. reduced-motion cannot pass on an empty set ------------------------
const acceptance = readFileSync(join(ROOT, "scripts", "acceptance.mjs"), "utf8");
check(
  "acceptance.mjs no longer selects .settle",
  !/querySelectorAll\([^)]*\.settle/.test(acceptance),
);
check(
  "acceptance.mjs asserts durations.length > 0 before .every()",
  /durations\.length\s*>\s*0\s*&&\s*durations\.every\(/.test(acceptance),
);
check(
  "acceptance.mjs still covers the three real selectors",
  /\.radar-sweep,\s*\.radar-pulse,\s*\.tick/.test(acceptance),
);

// --- 4. reduced-motion blanket rule is untouched --------------------------
check(
  "reduced-motion blanket rule still sets animation-duration",
  /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css) &&
    /animation-duration:\s*0\.001ms\s*!important/.test(css),
);

console.log(`\nARC-045 guardrail — ${ok.length} passed, ${failures.length} failed\n`);
for (const n of ok) console.log(`  PASS  ${n}`);
for (const n of failures) console.log(`  FAIL  ${n}`);
process.exit(failures.length === 0 ? 0 : 1);
