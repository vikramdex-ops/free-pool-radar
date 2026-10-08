# Project structure

Next.js 16 App Router, TypeScript, Tailwind CSS v4. The interesting part is
not the frontend — it is that the frontend owns none of the data. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the full picture.

## The one rule

**The site is a viewer of intelligence, not the intelligence engine.**

Collection, verification, normalisation and history all happen outside the
frontend. A change to a pool size, a quota or a provider's status reaches
production without a commit, a push or a deploy (§76). A deployment is only
ever required for a code change.

```text
pg_cron ──▶ pg_net ──▶ radar-sweep Edge Function ──▶ collectors
                                                          │
                              normalise ──▶ verify ──▶ change detection
                                                          │
                                                      Postgres
                                                          │
                                                 public read API
                                                          │
                                                    Next.js (ISR)
```

## Layout

```text
app/
  layout.tsx              theme pre-paint script, nav, fonts
  page.tsx                landing; ISR, 5 min
  live/                   the complete live set, filterable client-side
  providers/[slug]/       per-provider: offers, terms, history, evidence
  models/[slug]/          per-model: who serves it free, who stopped
  events/[slug]/          per-pool: capacity, countdown, exhaustion condition
  providers/ models/ compare/ timeline/ methodology/ ecosystem/ admin/ discovery/
  api/                    public read API (API.md)
    live/ offers/ upcoming/ ended/ providers/ models/ events/ changes/
    stats/                headline counts (feeds the README updater)
    dataset/              the whole dataset in one document
  data/latest.json/       same snapshot as /api/dataset
  data/latest.csv/        the live offer set, flattened
  feed.xml/               Atom feed of recent changes
  sitemap.ts robots.ts
  globals.css             the whole token system

components/
  Hero.tsx                hero, live ticker, upcoming cards
  RadarFromData.tsx       the hero dial
  LiveBrowser.tsx         client-side filter set (§21)
  Ledger.tsx              live offers: cards below 900px, table above
  Feed.tsx                new / changed / ended / source health
  Registry.tsx            provider index
  Methodology.tsx         the verification rules
  ui.tsx                  status, verification, freshness, evidence primitives

lib/
  db.ts                   read client, row types, every query
  format.ts               units, UTC dates, freshness, countdown, vocabulary
  publicData.ts           API serialisation, the envelope, datasetPayload
  site.ts                 the single origin (NEXT_PUBLIC_SITE_URL)
  theme.ts                dark default, pre-paint script
  auth.ts                 admin session cookie (HMAC)

mcp/
  server.mjs              dependency-free MCP server over stdio
  smoke.mjs               protocol handshake test (wired into CI)

supabase/
  migrations/             schema · RLS · scheduler · RPCs · reconcile · constraints
  functions/radar-sweep/  the collector and the sweep engine
  seed.sql                researched baseline, idempotent
  reset-data.sql          clears collected data, keeps schema and schedule
  vault.sql               one-time: put the secret key in Vault

scripts/
  verify.mjs              pages, themes, viewports, overflow, console
  update-readme-stats.mjs rewrites the README live block from /api/stats
  verify-data.mjs         checks the deployed API (scheduled, no secrets)
  check-seed.mjs          validates seed column counts
  test-*.mjs              offline checks (see .github/workflows/ci.yml)

docs/                     interface illustrations used by the README
.github/
  ISSUE_TEMPLATE/         new-provider, changed-offer, feature, bug
  workflows/              ci · update-readme-stats · verify-data · discover · release

Root docs: README · METHODOLOGY · ARCHITECTURE · API · DATASET ·
SELF_HOSTING · MCP · ECOSYSTEM · CONTRIBUTING · CODE_OF_CONDUCT · SECURITY ·
CHANGELOG · LICENSE · DATA-LICENSE
```

## Conventions that carry weight

**Colour means state, never decoration.** Green live, amber upcoming or
changed, red ended or impaired, grey stale, blue neutral. If something is
coloured it is reporting its status. Every colour is a token; component code
never names a raw colour.

**A missing figure is absent, not zero.** `lib/format.ts` exports `NOT_STATED`
and the UI uses it wherever a provider publishes nothing. Guessing a rate limit
is the failure mode this product is built to avoid.

**Units are reproduced verbatim.** Weighted tokens stay weighted tokens, dollars
stay dollars, requests are never converted into tokens.

**A failed read is never an empty result.** Every reader returns a `ReadResult`;
the API returns `503`, not `200 []`.

**Two database-level invariants, not two application-level ones.** An ended
offer cannot be revived, and offer and event identity is enforced by unique
indexes. Both live in the schema so no collector, seed or race can break them.

**Provenance is visible.** An offer confirmed by an automated source reads
differently from one established by documented research.
