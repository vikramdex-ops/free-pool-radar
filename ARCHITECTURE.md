# Architecture

Free Pool Radar is split so that the thing that changes constantly — the data —
never depends on the thing that changes rarely — the code.

**The site is a viewer of intelligence, not the intelligence engine.**

Collection, verification, normalisation and history all happen outside the
frontend. That is why a change to a pool size, a quota or a provider's status
reaches production without a commit, a push or a deploy. A deployment is only
ever required for a code change.

```text
pg_cron ──▶ pg_net ──▶ radar-sweep Edge Function (Deno) ──▶ 12 collectors
                                                               │
                          normalise ──▶ verify ──▶ change detection
                                                               │
                                                           Postgres
                                                               │
                                                    public read API (RLS)
                                                               │
                        Next.js (ISR) ──▶ site · REST API · datasets · RSS · MCP
```

---

## Components

| Layer | Choice | Location |
|---|---|---|
| **Database** | Supabase Postgres | `supabase/migrations/` |
| **Scheduler** | `pg_cron` + `pg_net` | `supabase/migrations/0003_schedule.sql` |
| **Collector** | Supabase Edge Function (Deno) | `supabase/functions/radar-sweep/` |
| **Write path** | Stored procedures only | `supabase/migrations/0004_sweep_rpc.sql` |
| **Frontend** | Next.js App Router, ISR | `app/` |
| **Read layer** | Publishable-key client | `lib/db.ts`, `lib/publicData.ts` |
| **Public API** | Route handlers, `revalidate = 300` | `app/api/` |
| **Feed** | Atom route | `app/feed.xml/` |

---

## The five-hour gate

The schedule is a **deterministic gate, not a cron expression**. `pg_cron`
ticks hourly and the sweep function does work only once five hours have elapsed
since the last run, so a missed tick is caught by the next one instead of
permanently shifting the schedule. The tolerance is explicit in
`supabase/migrations/0015_sweep_gate_tolerance.sql`.

The frontend's ISR window (`revalidate = 300`) is deliberately short: a long
stale-while-revalidate window would compound with the ISR interval, so a change
the collector had already written could take ten minutes to appear — the site
would look like it had missed an update it had actually recorded.

---

## Data model

```text
providers     the registry: name, official URL, type, country, status
models        every model seen on a free route, with context and capabilities
offers        one free route: type, status, card/subscription/key terms, quotas
events        shared pools and promotions, with pool size and start time
observations  append-only: one row per sweep in which a collected value changed
changes       append-only: one row per detected difference between two sweeps
```

**Two invariants are enforced in the schema, not only in application code**, so
no collector, seed or race can break them:

1. **An ended offer cannot be revived** by a source that still reports it.
2. **Offer and event identity is enforced by unique indexes**
   (`0007_offer_identity.sql`).

---

## Access control

| Credential | Scope |
|---|---|
| Supabase **publishable** key | Browser-safe. Reads only what RLS exposes to `anon`. |
| Supabase **secret** key | Bypasses RLS. Server-only — Supabase Vault for the sweep, `SUPABASE_SECRET_KEY` for `/admin` and `/discovery`. |

- **RLS is enabled on every table** the frontend reads (`0002_rls.sql`).
- **Writes are revoked from `anon`.** Every stored procedure that mutates data
  is inaccessible to the publishable key.
- **Observations are append-only.** A verification record is never updated in
  place, so the audit trail cannot be quietly rewritten.
- `/admin` and `/discovery` require a signed session cookie. With either admin
  variable unset, sign-in **refuses** and the routes stay closed — they do not
  fall open.

---

## Frontend conventions that carry weight

- **Colour means state, never decoration.** Green live, amber upcoming or
  changed, red ended or impaired, grey stale, blue neutral. Every colour is a
  token; component code never names a raw colour.
- **A missing figure is absent, not zero.** `lib/format.ts` exports
  `NOT_STATED` and the UI uses it wherever a provider publishes nothing.
- **Units are reproduced verbatim.**
- **A failed read is never rendered as an empty result.** Every reader returns
  a `ReadResult`, and a failed read surfaces as an explicit error, not as "no
  providers". The public API returns a `503`, not a `200` with `[]`.
- **Dark is the default.** Light is a separate palette, not an inversion.

---

## Directory map

```text
app/                    routes: page, live, providers, models, events, compare,
                        timeline, methodology, ecosystem, api/, feed.xml, sitemap
components/             Hero, Ledger, Feed, Registry, LiveBrowser, Methodology,
                        RadarFromData, RadarStats, ui primitives
lib/                    db.ts (reads + row types), publicData.ts (API shape),
                        format.ts (units, UTC, freshness), site.ts, auth.ts
supabase/
  migrations/           schema · RLS · scheduler · RPCs · reconcile · constraints
  functions/radar-sweep the collector and the sweep engine
  seed.sql              researched baseline, idempotent
  reset-data.sql        clears collected data, keeps schema and schedule
  vault.sql             one-time: put the secret key in Vault
mcp/                    dependency-free MCP server (stdio)
scripts/                offline checks, verify.mjs, fixtures, one-off repairs
docs/                   interface illustrations used by the README
```

---

## Why not server-render the data from the repo?

Because the data is not in the repo. The repository holds the *engine* — schema,
collectors, read layer and interface. The dataset lives in Postgres and is
written by the pipeline. The two are decoupled on purpose: open-sourcing the
engine does not require publishing secrets, and publishing the dataset (CC0)
does not require redeploying the app.

See [DATASET.md](DATASET.md) for the downloadable exports and
[SELF_HOSTING.md](SELF_HOSTING.md) for standing up your own.
