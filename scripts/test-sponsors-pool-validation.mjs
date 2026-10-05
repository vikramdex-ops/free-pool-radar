// LED-048: a malformed sponsors payload must fail loudly, never zero the pool.
//
// A renamed/wrapped sponsors key (or non-numeric cents) currently reduces via
// `sp.sponsors || []` to an empty list, so poolSize, poolRemaining and
// creditAmount are stored as 0 while status stays live - an unreadable pool
// recorded as an exhausted one. Invariant 3: unreadable becomes null/throws,
// never a measured zero.
//
// Run: node scripts/test-sponsors-pool-validation.mjs (static; needs no server).
// Behavioral: stubs global fetch, drives the real sponsoredtokens collector.
import assert from "node:assert/strict";
import { COLLECTOR_BY_KEY } from "../supabase/functions/radar-sweep/core/collectors.ts";

const sponsorsUrl = "https://sponsoredtokens.com/api/sponsors";
const flagsUrl = "https://sponsoredtokens.com/api/flags";

const okSponsors = [
  { displayName: "A", balanceCents: 10000, lifetimeCents: 3700, spentCents: 6300 },
];

function stubFetch(sponsorsBody) {
  globalThis.fetch = async (url) => {
    if (String(url) === sponsorsUrl) {
      return new Response(JSON.stringify(sponsorsBody), { status: 200 });
    }
    if (String(url) === flagsUrl) {
      return new Response(JSON.stringify({ poolPaused: false }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

const collect = () => COLLECTOR_BY_KEY.get("sponsoredtokens.pool").collect();

let failures = 0;
async function rejects(name, body) {
  stubFetch(body);
  try {
    const res = await collect();
    const o = res.offers[0];
    failures++;
    console.error(
      `FAIL ${name}: resolved instead of rejecting ` +
        `(poolSize=${o.poolSize} poolRemaining=${o.poolRemaining} creditAmount=${o.creditAmount})`,
    );
  } catch (e) {
    console.log(`ok ${name}: rejected (${String(e.message).slice(0, 60)})`);
  }
}

// 1. Renamed key: sponsors list missing entirely.
await rejects("renamed sponsors key", {
  sponsorList: okSponsors,
});

// 2. Wrapped payload: sponsors nested one level down.
await rejects("wrapped sponsors payload", { data: { sponsors: okSponsors } });

// 3. Non-numeric cents: a balance that is not a number.
await rejects("non-numeric balanceCents", {
  sponsors: [
    { displayName: "A", balanceCents: "lots", lifetimeCents: 3700, spentCents: 6300 },
  ],
});

// 4. Well-formed nonzero payload still resolves with exact figures.
stubFetch({ sponsors: okSponsors });
{
  const res = await collect();
  const o = res.offers[0];
  assert.equal(o.poolSize, 37);
  assert.equal(o.poolRemaining, 100);
  assert.equal(o.creditAmount, 100);
  assert.equal(o.status, "live");
  console.log("ok well-formed payload resolves with exact figures");
}

// 5. Genuinely empty sponsor list is a measured zero, not a malformed one.
stubFetch({ sponsors: [] });
{
  const res = await collect();
  const o = res.offers[0];
  assert.equal(o.poolSize, 0);
  assert.equal(o.poolRemaining, 0);
  console.log("ok empty sponsor list resolves as a true zero");
}

if (failures > 0) {
  console.error(`\n${failures} malformed payload(s) resolved instead of rejecting`);
  process.exit(1);
}
console.log("\nLED-048 green: malformed sponsors payloads fail loudly");
