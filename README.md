# Free Pool Radar

> **Every free AI inference pool. Every disappearing quota. One live radar.**

Free access to AI models is not a category. It is a claim ΓÇö and almost every
claim you find on the internet is either unverified, out of date, or quietly
obscuring the fact that a "free tier" needs a payment method before it will
answer a single request.

Free Pool Radar is a continuously updated index of genuinely free AI inference:
shared token pools, free model endpoints, sponsored inference, promotional
credits, keyless routes and rotating free models. Every figure is read from an
official source and re-verified on a five-hour cycle. Nothing is ranked,
nothing is scored, and when a free tier is withdrawn the record of it stays.

---

## What makes this different from a list

A list of "free AI APIs" goes stale within a week and never says *which* free.
This one is built to be wrong loudly rather than quietly right:

- **Evidence, not vibes.** Every important number carries the URL it was read
  from, when, and at which level of the evidence hierarchy. A provider that does
  not publish a rate limit shows *not publicly stated* ΓÇö never a zero, never a
  guess.
- **A failed source is not an ended offer.** When a source cannot be reached we
  record the failure and leave its offers untouched. Those offers go stale on a
  timer. This is the single most important rule in the codebase, because the
  alternative is an outage that looks like a mass withdrawal.
- **Units are never converted.** A pool quoted in *weighted tokens* is labelled
  weighted tokens. Dollars stay dollars. Requests are not silently turned into
  tokens.
- **History is never deleted.** Chutes retired its free tier in March 2026.
  GitHub Models went dark in July. Both are still here, with the reason and the
  evidence, because "does this provider have a free tier" is a question whose
  answer gets more useful when the site remembers.
- **Conflicts are preserved.** OpenRouter documents 50 requests a day for
  unfunded accounts and 1,000 after ten dollars of lifetime credit. Both
  readings are stored. Neither is quietly chosen.

---

## How it works

The frontend is a viewer, not the engine. Data is collected, verified and
written to Postgres on a schedule, and the site reads whatever is currently
true.

```
pg_cron  ΓöÇΓöÇΓû╢  Supabase Edge Function  ΓöÇΓöÇΓû╢  collectors
                                              Γöé
                     normalise ΓöÇΓöÇΓû╢ verify ΓöÇΓöÇΓû╢ change detection
                                              Γöé
                                          Postgres
                                              Γöé
                                     public read API
                                              Γöé
                                          Next.js (ISR)
```

| Layer | Choice | Why |
| --- | --- | --- |
| Database | Supabase Postgres | Six entities, append-only history, RLS for public reads |
| Scheduler | `pg_cron` + `pg_net` | Runs every 5 hours, independent of the frontend |
| Collector | Supabase Edge Function (Deno) | Fetches providers, reconciles, returns a report |
| Frontend | Next.js on Vercel | Reads the database; never needs a redeploy for data |
| Writes | Stored procedures only | One audited path into the intelligence store |

**The five-hour schedule** is a deterministic gate, not a cron expression.
`pg_cron` ticks hourly and the function only does work once five hours have
elapsed since the last run, so a missed tick is caught by the next one instead
of permanently shifting the schedule.

**A data change never needs a deployment.** Adding an offer, draining a pool,
raising a rate limit or withdrawing access all happen in the database. The site
picks them up on revalidation. A deploy is only ever required for a code
change.

---

## Data model

```
providers   the registry: name, official URL, type, country, status
models      every model seen on a free route, with context and capabilities
offers      one free route: type, status, card/subscription/key terms, quotas
events      shared pools and promotions, with pool size and start time
observations append-only: one row per source per sweep
changes     append-only: one row per detected difference between two sweeps
```

**Status** is exactly one of `upcoming`, `live`, `changed`, `ending`,
`exhausted`, `ended`, `suspended`, `unverified`.

**Access type** is tracked separately: `shared_pool`, `free_tier`,
`rotating_free_model`, `sponsored_inference`, `promotional_event`,
`free_credits`, `keyless`, `free_trial`, `ended`. An offer can be a shared pool
that is *also* rate limited and *also* card-gated. Collapsing those into one
"free" badge is the mistake this product exists to avoid.

**Verification level** is one of `live_api`, `official_docs`,
`official_event_page`, `official_announcement`, `official_social`, `secondary`,
`community` ΓÇö a named rank, not a numerical trust score.

---

## Public API

Read-only, no key required, same data the site renders.

```
GET /api/live         currently usable free routes
GET /api/offers       the same set under its fuller name
GET /api/upcoming     announced pools and events
GET /api/ended        withdrawn access, retained permanently
GET /api/providers    the provider registry
GET /api/models       every model on a free route
GET /api/events       pools and promotional events
GET /api/changes      the change log (?type=card_required&limit=50)
```

```bash
curl https://free-pool-radar.vercel.app/api/upcoming | jq '.data.events[0]'
```

```json
{
  "slug": "apmix-community-event",
  "name": "Community event ΓÇö shared token pool",
  "provider": "APMix",
  "status": "upcoming",
  "startAt": "2026-10-02T17:00:00Z",
  "poolSize": 10000000000,
  "unit": "weighted_tokens",
  "models": ["gpt-6-luna-free"],
  "requirements": "API key required. No payment method.",
  "exhaustionCondition": "Requests answer 403 event_ended once the pool is spent",
  "officialUrl": "https://apmix.ai/event"
}
```

Timestamps are ISO 8601. The editorial `28 SEP 2026 ┬╖ 17:00 UTC` form is a
presentation choice for the site, not the wire format.

---

## Running it locally

```bash
git clone https://github.com/vikramdex-ops/free-pool-radar.git
cd free-pool-radar
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

You need a Supabase project and its publishable key. Nothing else.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The frontend will render an explicit *database not configured* state rather
than sample data if these are missing ΓÇö it will never invent a figure.

### Database and monitoring

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push                      # schema, RLS, scheduler, RPCs
npx supabase db query --linked --file supabase/seed.sql   # researched baseline
npx supabase functions deploy radar-sweep --no-verify-jwt
```

Put the project's secret key in Supabase Vault under `supabase_secret_key` so
`pg_net` can authenticate the scheduled call ΓÇö see `supabase/vault.sql`. Then
the hourly tick picks it up and the first sweep runs within the hour.

To rebuild a dataset from scratch, `supabase/reset-data.sql` clears the
collected data and leaves the schema, policies, procedures and schedule intact.

### Checks

```bash
npx tsc --noEmit                 # types
node scripts/check-seed.mjs supabase/seed.sql
node scripts/verify.mjs          # pages, both themes, both viewports
```

`verify.mjs` asserts every page returns 200 with no console errors, that nothing
scrolls sideways at 390px or 1440px, and that no content escapes its container.
It expects a server on `$BASE` (default `http://localhost:3100`).

---

## The rule that matters

```sql
-- rpc_update_offer, in the database, not just in the collector:
where o.id = (p->>'id')::bigint
  and not (o.status = 'ended' and coalesce(p->>'status','') <> 'ended')
```

An ended offer cannot be revived by a source that still reports it, and a failed
fetch never reaches this statement at all. Those two properties are what make
the history trustworthy over years rather than months.

---

## What this project will not do

- Rank providers, or publish a quality score
- Call a time-boxed trial "free" without saying when it ends
- Present a promotional credit as equivalent to pooled tokens
- Republish a third-party list without verifying each entry
- Resolve a conflict by quietly picking a side
- Fill an empty state with invented data
- Delete a record because an offer ended

---

## Independent

Free Pool Radar is an independent information service. It is not affiliated with,
endorsed by, or sponsored by any provider listed. It takes no payment from
providers and uses no affiliate links.

Free access can be withdrawn, rate-limited, modified or exhausted without
notice. Always review the provider's current terms, privacy policy and usage
restrictions before sending sensitive or production data. All timestamps are
UTC.

MIT.

DELIBERATE CONFLICT PROBE - this line exists to force a merge conflict with main.
