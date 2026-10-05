// APR-053: term-only queries must not return every model and every event.
//
// Behavioural red-green test: imports lib/search.ts (never only reads it)
// and runs term-only, mixed, and free-text-only queries over fixtures.
// Run: node scripts/test-search-gates.mjs (no server, no database).
import assert from "node:assert/strict";
import { search } from "../lib/search.ts";

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

const provider = (over = {}) => ({
  id: 1, name: "Alpha Pool", slug: "alpha-pool",
  official_url: "https://alpha.example", logo_url: null,
  description: "A shared inference pool", provider_type: "pool",
  country: null, status: "active", free_model_count: 2, live_offer_count: 2,
  created_at: "2026-01-01", updated_at: "2026-01-01", last_verified_at: null,
  ...over,
});

const offer = (over = {}) => ({
  id: 1, provider_id: 1, model_id: null, model_id_text: "alpha-1",
  model_label: "Alpha One", offer_type: "shared_pool", status: "live",
  access_requires_account: false, access_requires_subscription: false,
  payment_required: false, card_required: false, api_key_required: true,
  keyless: false, compatibility_openai: true, compatibility_anthropic: false,
  compatibility_other: null, rpm: null, rpd: null, tpm: null, tpd: null,
  monthly_limit: null, monthly_unit: null, token_limit: null,
  token_limit_unit: null, pool_size: null, pool_remaining: null,
  pool_unit: null, credit_amount: null, credit_currency: null,
  start_at: null, end_at: null, exhaustion_condition: null,
  commercial_use: null, data_policy: null, retention_policy: null,
  official_evidence_url: null, secondary_evidence_url: null,
  verification_level: "official", confidence: null,
  first_discovered_at: "2026-01-01", first_verified_at: null,
  last_verified_at: null, last_seen_live_at: null, ended_at: null,
  is_seed_data: false, provider: provider(),
  ...over,
});

const model = (over = {}) => ({
  id: 1, provider_id: 1, model_id: "alpha-1", slug: "alpha-one",
  display_name: "Alpha One", family: "Alpha", parameter_count: null,
  context_window: null, capabilities: [], official_model_url: null,
  first_seen_at: "2026-01-01", updated_at: "2026-01-01",
  ...over,
});

const input = {
  providers: [provider(), provider({ id: 2, name: "Beta Labs", slug: "beta-labs", description: "API lab" })],
  models: [model(), model({ id: 2, model_id: "beta-1", slug: "beta-one", display_name: "Beta One", family: "Beta" })],
  offers: [
    offer(),
    offer({ id: 2, model_label: "Beta One", model_id_text: "beta-1", keyless: true, api_key_required: false, provider: provider({ id: 2, name: "Beta Labs", slug: "beta-labs", description: "API lab" }) }),
  ],
  events: [
    { id: 1, slug: "launch-week", name: "Launch Week" },
    { id: 2, slug: "summer-credits", name: "Summer Credits" },
  ],
  changes: [],
  now: Date.now(),
};
void assert;

// 1. Term-only "keyless": exactly the keyless offer; no models, no events.
{
  const r = search({ ...input, query: "keyless" });
  check("term-only freeText is empty", r.freeText === "", `freeText was ${JSON.stringify(r.freeText)}`);
  check("term-only terms name keyless", r.terms.includes("keyless access"), `terms were ${JSON.stringify(r.terms)}`);
  const kinds = r.hits.map((h) => h.kind);
  check("term-only returns the keyless offer", r.hits.some((h) => h.kind === "offer" && h.id === "offer-2"), JSON.stringify(r.hits));
  check("term-only returns no models", !kinds.includes("model"), JSON.stringify(r.hits));
  check("term-only returns no events", !kinds.includes("event"), JSON.stringify(r.hits));
}

// 2. Mixed "alpha keyless": terms AND free text (offer must satisfy both).
// Offer-1 matches the free text but is not keyless, so it must drop.
{
  const r = search({ ...input, query: "alpha keyless" });
  const offerIds = r.hits.filter((h) => h.kind === "offer").map((h) => h.id);
  check("mixed query drops the non-keyless alpha offer", !offerIds.includes("offer-1"), JSON.stringify(offerIds));
}

// 3. Free-text-only "alpha": substring behaviour unchanged (no recognised terms).
{
  const r = search({ ...input, query: "alpha" });
  const kinds = new Set(r.hits.map((h) => h.kind));
  check("free-text still matches models", kinds.has("model"), JSON.stringify(r.hits));
  check("free-text still matches providers", kinds.has("provider"), JSON.stringify(r.hits));
  check("free-text still matches offers", kinds.has("offer"), JSON.stringify(r.hits));
}

if (failures > 0) {
  console.error(`\n${failures} gate assertion(s) failed`);
  process.exit(1);
}
console.log("\nAPR-053 green: no query is a query for all");
