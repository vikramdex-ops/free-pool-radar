// LED-050: apmix reads all event state from a fixed 700-char window.
//
// A page reorder pushing pool/remaining/status outside the window reads
// identically to an unpublished field (null since LED-049) - with no error
// at all. Distinguish the two: present in a wider window but absent from the
// parse window means structural break (throw, fail loudly like the missing
// marker); absent from both means unpublished (null).
//
// Run: node scripts/test-apmix-window-guard.mjs (static; needs no server).
// Behavioral: stubs global fetch with RSC-shaped HTML, drives the real
// apmix collector.
import assert from "node:assert/strict";
import { COLLECTOR_BY_KEY } from "../supabase/functions/radar-sweep/core/collectors.ts";

const url = "https://apmix.ai/event";

function stubHtml(html) {
  globalThis.fetch = async (u) => {
    assert.equal(String(u), url);
    return { ok: true, status: 200, text: async () => html };
  };
}

const collect = () => COLLECTOR_BY_KEY.get("apmix.event").collect();
const fields = '"modelId":"m","status":"live","pool":100,"remaining":50,"startsAt":"2026-01-01"';

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

// 1. Normal payload parses.
stubHtml(`noise "initial":{${fields}} trailing`);
{
  const o = (await collect()).offers[0];
  check(
    "normal payload parses",
    o.poolSize === 100 && o.poolRemaining === 50,
    `poolSize=${o.poolSize} poolRemaining=${o.poolRemaining}`,
  );
}

// 2. Reordered page pushes pool fields outside the 700-char window but
// inside a wider one: must throw naming the field, not read nulls.
stubHtml(`noise "initial":{"modelId":"m","status":"live"${"x".repeat(1000)},"pool":100,"remaining":50,"startsAt":"2026-01-01"} trailing`);
{
  try {
    const o = (await collect()).offers[0];
    check(
      "pushed-out fields throw",
      false,
      `resolved with poolSize=${o.poolSize} poolRemaining=${o.poolRemaining}`,
    );
  } catch (e) {
    check(
      "pushed-out fields throw",
      /outside parse window/.test(String(e.message)),
      String(e.message),
    );
  }
}

// 3. Genuinely absent pool fields (nowhere in the page): null, no throw.
stubHtml(`noise "initial":{"modelId":"m","status":"live","startsAt":"2026-01-01"} trailing`);
{
  const o = (await collect()).offers[0];
  check(
    "genuinely absent fields stay null",
    o.poolSize === null && o.poolRemaining === null,
    `poolSize=${o.poolSize} poolRemaining=${o.poolRemaining}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} case(s) failed`);
  process.exit(1);
}
console.log("\nLED-050 green: window breaks fail loudly, absence stays null");
