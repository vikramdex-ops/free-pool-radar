// LED-049: apmix reads an unread pool field as 0 instead of null.
//
// num() returns 0 when its regex does not match, so a pool value the page
// does not publish is stored as a measured zero (recorded as exhausted)
// rather than left null ("Not publicly stated"). The str() helper directly
// above already returns null correctly. Invariant 3: unreadable is null,
// never 0.
//
// Run: node scripts/test-apmix-null-not-zero.mjs (static; needs no server).
// Behavioral: stubs global fetch with RSC-shaped HTML, drives the real
// apmix collector and asserts on poolSize / poolRemaining.
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
const wrap = (inner) => `noise noise "initial":{${inner}} trailing noise`;

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

// 1. Pool fields absent from the payload: must be null, not 0.
stubHtml(
  wrap('"modelId":"test-model","status":"live","startsAt":"2026-01-01"'),
);
{
  const res = await collect();
  const o = res.offers[0];
  check(
    "absent pool fields are null",
    o.poolSize === null && o.poolRemaining === null,
    `poolSize=${o.poolSize} poolRemaining=${o.poolRemaining}`,
  );
}

// 2. Genuinely published zeros stay zero (a true zero is a measurement).
stubHtml(
  wrap(
    '"modelId":"test-model","status":"live","pool":0,"remaining":0,"startsAt":"2026-01-01"',
  ),
);
{
  const res = await collect();
  const o = res.offers[0];
  check(
    "published zeros stay zero",
    o.poolSize === 0 && o.poolRemaining === 0,
    `poolSize=${o.poolSize} poolRemaining=${o.poolRemaining}`,
  );
}

// 3. Well-formed nonzero payload parses exactly.
stubHtml(
  wrap(
    '"modelId":"test-model","status":"live","pool":100,"remaining":50,"startsAt":"2026-01-01"',
  ),
);
{
  const res = await collect();
  const o = res.offers[0];
  check(
    "published figures parse exactly",
    o.poolSize === 100 && o.poolRemaining === 50,
    `poolSize=${o.poolSize} poolRemaining=${o.poolRemaining}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} case(s) read an absent field as zero`);
  process.exit(1);
}
console.log("\nLED-049 green: unread pool fields stay null");
