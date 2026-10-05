// LED-053: OpenRouter publishes a null price as a free model.
//
// The filter coerces with Number() and compares to 0. Number(undefined) is
// NaN and safe, but Number(null) is 0 and Number('') is 0, so a model whose
// price comes back null or empty is treated as free and written as a live
// free offer with evidence asserting both prices are "0". The anyrouter
// collector in the same file already handles this deliberately with a
// ?? 1 non-zero default - this reuses that in-repo pattern verbatim.
//
// Run: node scripts/test-openrouter-null-price.mjs (static; needs no server).
// Behavioral: stubs global fetch, drives the real openrouter collector.
import assert from "node:assert/strict";
import { COLLECTOR_BY_KEY } from "../supabase/functions/radar-sweep/core/collectors.ts";

const url = "https://openrouter.ai/api/v1/models";

function stubModels(data) {
  globalThis.fetch = async (u) => {
    assert.equal(String(u), url);
    return new Response(JSON.stringify({ data }), { status: 200 });
  };
}

const collect = () => COLLECTOR_BY_KEY.get("openrouter.models").collect();
const model = (id, prompt, completion) => ({ id, pricing: { prompt, completion } });

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

// 1. Null prices must not read as free.
stubModels([
  model("m-null", null, null),
  model("m-empty", "", ""),
  model("m-undef", undefined, undefined),
  model("m-free", "0", "0"),
]);
{
  const res = await collect();
  const ids = res.offers.map((o) => o.modelId);
  check(
    "null/empty/undefined prices excluded",
    !ids.includes("m-null") && !ids.includes("m-empty") && !ids.includes("m-undef"),
    `offered=[${ids.join(",")}]`,
  );
  check("string zero prices included", ids.includes("m-free"), `offered=[${ids.join(",")}]`);
}

// 2. Numeric zeros still count (genuine free tier, both fields).
stubModels([{ id: "m-num", pricing: { prompt: 0, completion: 0 } }]);
{
  const res = await collect();
  check(
    "numeric zero prices included",
    res.offers.some((o) => o.modelId === "m-num"),
    `offered=[${res.offers.map((o) => o.modelId).join(",")}]`,
  );
}

// 3. Mixed: zero prompt but null completion is not provably free.
stubModels([{ id: "m-mixed", pricing: { prompt: "0", completion: null } }]);
{
  const res = await collect();
  check(
    "half-null prices excluded",
    !res.offers.some((o) => o.modelId === "m-mixed"),
    `offered=[${res.offers.map((o) => o.modelId).join(",")}]`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} case(s) failed`);
  process.exit(1);
}
console.log("\nLED-053 green: only provable zero prices read as free");
