// LED-052: an absent poolPaused flag must not read as "not paused".
//
// `fl.poolPaused ? "suspended" : "live"` treats a dropped or renamed key as
// a live pool - and un-suspends a stored suspended status - inventing state
// from an absent field. Absence is an expected shape (the flags type marks
// it optional), so the honest response is to fail loudly like the other
// collectors do on malformed shape (freetheai "no catalog", joule
// "no capacity"), leaving prior values untouched per invariant 3.
//
// Run: node scripts/test-poolpaused-absent-throws.mjs (static; needs no server).
// Behavioral: stubs global fetch, drives the real sponsoredtokens collector.
import assert from "node:assert/strict";
import { COLLECTOR_BY_KEY } from "../supabase/functions/radar-sweep/core/collectors.ts";

const sponsorsUrl = "https://sponsoredtokens.com/api/sponsors";
const flagsUrl = "https://sponsoredtokens.com/api/flags";

const sponsorsBody = {
  sponsors: [
    { displayName: "A", balanceCents: 10000, lifetimeCents: 3700, spentCents: 6300 },
  ],
};

function stubFlags(flagsBody) {
  globalThis.fetch = async (url) => {
    if (String(url) === sponsorsUrl) {
      return new Response(JSON.stringify(sponsorsBody), { status: 200 });
    }
    if (String(url) === flagsUrl) {
      return new Response(JSON.stringify(flagsBody), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

const collect = () => COLLECTOR_BY_KEY.get("sponsoredtokens.pool").collect();

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

// 1. Absent flag: must reject, never resolve live.
stubFlags({});
{
  try {
    const res = await collect();
    check("absent poolPaused rejects", false, `resolved status=${res.offers[0].status}`);
  } catch (e) {
    check("absent poolPaused rejects", true, "");
  }
}

// 2. Explicit true still suspends.
stubFlags({ poolPaused: true });
{
  const res = await collect();
  check(
    "poolPaused true suspends",
    res.offers[0].status === "suspended",
    `status=${res.offers[0].status}`,
  );
}

// 3. Explicit false still live.
stubFlags({ poolPaused: false });
{
  const res = await collect();
  check(
    "poolPaused false stays live",
    res.offers[0].status === "live",
    `status=${res.offers[0].status}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} case(s) failed`);
  process.exit(1);
}
console.log("\nLED-052 green: absent poolPaused fails loudly");
