# Project structure

Next.js 16 App Router, TypeScript, Tailwind CSS v4. The interesting part is
not the frontend — it is that the frontend owns none of the data.

## The one rule

**The site is a viewer of intelligence, not the intelligence engine.**

Collection, verification, normalisation and history all happen outside the
frontend. That is why a change to a pool size, a quota or a provider's status
reaches production without a commit, a push or a deploy (§76 of the product
spec). A deployment is only ever required for a code change.

```
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

```
app/
  layout.tsx              theme pre-paint script, nav, fonts
  page.tsx                landing; ISR, 5 min
  live/                   the complete live set, filterable client-side
  providers/[slug]/       per-provider: offers, terms, history, evidence
  models/[slug]/          per-model: who serves it free, who stopped
  events/[slug]/          per-pool: capacity, countdown, exhaustion condition
  providers/ models/ compare/ timeline/ methodology/ admin/
  api/                    public read API (§37)
  globals.css             the whole token system

components/
  Radar.tsx               the hero dial + headline figures
  Hero.tsx                hero, live ticker, upcoming cards
  LiveBrowser.tsx         client-side filter set (§21)
  Ledger.tsx              live offers: cards below 900px, table above
  Feed.tsx                new / changed / ended / source health
  Registry.tsx            provider index
  Methodology.tsx         the verification rules
  ui.tsx                  status, verification, freshness, evidence primitives

lib/
  db.ts                   read client, row types, every query
  format.ts               units, UTC dates, freshness, countdown, vocabulary
  publicData.ts           API serialisation and the response envelope
  theme.ts                dark default, pre-paint script

supabase/
  migrations/             0001 schema · 0002 RLS · 0003 scheduler
                          0004 sweep RPCs · 0005 set-based reconcile
                          0006 event suspended · 0007 identity constraints
  functions/radar-sweep/  the collector and the sweep engine
  seed.sql                researched baseline, idempotent
  reset-data.sql          clears collected data, keeps schema and schedule
  vault.sql               one-time: put the secret key in Vault

scripts/
  check-seed.mjs          validates seed column counts before running
  verify.mjs              pages, themes, viewports, overflow, console
  overflow.mjs            names the elements that exceed the viewport
  shot.mjs                viewport-scale screenshot
  dedupe-events.sql       one-off repair, kept for provenance
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

**Two database-level invariants, not two application-level ones.** An ended
offer cannot be revived, and offer and event identity is enforced by unique
indexes. Both live in the schema so no collector, seed or race can break them.

**Provenance is visible.** An offer confirmed by an automated source reads
differently from one established by documented research, because pretending
they are the same would be the quiet overstatement this product exists to
avoid.
