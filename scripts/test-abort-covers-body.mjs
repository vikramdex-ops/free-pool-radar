// LED-051: the abort timeout must cover the body read, not just the headers.
//
// get() cleared its timer in `finally` as soon as fetch resolved (headers),
// but callers consumed the body afterwards (r.json()/r.text()) - so a server
// that sends headers then stalls the body hangs a sweep whose collectors run
// strictly in series with no aggregate bound. The timer must stay armed until
// the body is consumed; json()/text() release it afterwards.
//
// A behavioral stall test would need a 15s timeout, so this test asserts the
// lifecycle structurally: no finally-clear in get(), release-after-body in
// both readers, and no direct get() caller left outside them.
// Run: node scripts/test-abort-covers-body.mjs (static; needs no server).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const src = readFileSync(
  new URL("../supabase/functions/radar-sweep/core/collectors.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

function span(name) {
  // Slice one top-level `async function <name> ... }` block; null when the
  // function does not exist (which is itself a meaningful red).
  const start = src.indexOf(`async function ${name}`);
  if (start === -1) return null;
  const end = src.indexOf("\n}\n", start);
  if (end === -1) return null;
  return src.slice(start, end);
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

const getFn = span("get") ?? "";
check(
  "get() does not clear the timer on headers",
  !/}\s*finally\s*\{/.test(getFn),
  "get() still clears in finally: a stalled body after headers has no timeout",
);

const jsonFn = span("json");
check(
  "json() releases after the body is consumed",
  jsonFn !== null && /await r\.json\(\)[\s\S]*?release\(\)/.test(jsonFn),
  "json() must release the timer after r.json(), not before",
);

const textFn = span("text");
check(
  "text() releases after the body is consumed",
  textFn !== null && /await r\.text\(\)[\s\S]*?release\(\)/.test(textFn),
  "text() must release the timer after r.text(), not before",
);

check(
  "apmix reads its body through text(), not a bare get()",
  /const \{ status, body: html \} = await text\(url\)/.test(src),
  "a direct get() caller would hold an unreleased timer path",
);

if (failures > 0) {
  console.error(`\n${failures} timer-lifecycle assertion(s) failed`);
  process.exit(1);
}
console.log("\nLED-051 green: abort covers headers and body");
