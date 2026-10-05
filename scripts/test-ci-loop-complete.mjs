// Guard: every offline test is either wired into the CI loop or denied
// with a recorded reason. Three merges each added a test and left ci.yml
// alone, so an unwired test is the default outcome, not an oversight - this
// check makes it a failure instead.
//
// The deny list is not a second-class citizen: each entry names the
// capability CI lacks (browser binary, deployment + credentials, live
// database). Preferred shape for NEW tests is static-unconditional plus a
// network half behind `if (!process.env.BASE)` (see test-sitemap-fresh.mjs),
// so future tests do not join the deny list by accident.
//
// Run: node scripts/test-ci-loop-complete.mjs (static; needs no server).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ci = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8").replace(
  /\r\n/g,
  "\n",
);

// Entries of the `for t in` offline-check loop. Anchored to backslash
// continuations: a name without one terminates the list in bash (ARC-046),
// so the parse mirrors the shell rather than guessing at it.
const loopBody = ci.match(/for t in \\\n((?:[ \t]+\S+[ \t]*\\\n)+[ \t]+\S+)/);
if (!loopBody) {
  console.error("FAIL ci loop unparseable: for t in block not found");
  process.exit(1);
}
const looped = new Set(loopBody[1].split(/\s+/).filter((t) => t && t !== "\\"));

// Deny map: test file stem -> the CI-missing capability that keeps it out.
// A deny entry without a reason is the same defect as an unwired test.
const DENY = new Map([
  ["test-new-routes", "needs playwright browser binary + localhost server"],
  ["test-prod-auth", "needs deployed URL + ADMIN_PASSWORD credential"],
  ["test-provider-filter", "needs live database (anon key)"],
  ["test-read-errors", "needs live database (PostgREST behaviour)"],
]);
for (const [name, reason] of DENY) {
  if (!reason || !reason.trim()) {
    console.error(`FAIL deny entry ${name} carries no reason`);
    process.exit(1);
  }
}

const files = readdirSync(join(root, "scripts"))
  .filter((f) => f.startsWith("test-") && f.endsWith(".mjs"))
  .map((f) => f.slice(0, -".mjs".length));

let failures = 0;
for (const name of files.sort()) {
  if (looped.has(name) || DENY.has(name)) {
    console.log(`ok ${name} wired or denied with reason`);
  } else {
    failures++;
    console.error(`FAIL ${name}: in scripts/ but neither in the CI loop nor denied`);
  }
}
for (const name of [...looped].sort()) {
  if (!files.includes(name)) {
    failures++;
    console.error(`FAIL ${name}: in the CI loop but no such script exists`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} wiring gap(s): add the test to ci.yml or deny it with reason`);
  process.exit(1);
}
console.log("\nci-loop-complete green: every test wired or denied");
