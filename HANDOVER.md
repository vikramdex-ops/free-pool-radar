# HANDOVER.md

Operating notes for Free Pool Radar. Written for an agent or engineer picking
this up cold.

Read this before changing anything. The short version: the database is the
product, the frontend only displays it, and the invariants in the last section
are the ones that must not be broken.

---

## 1. Locations

| What | Where |
|---|---|
| Project root | `C:\Users\vikram\Documents\Default Project\free-pool-radar` |
| Parent dir (holds Playwright) | `C:\Users\vikram\Documents\Default Project` |
| Governing spec (89 sections) | `PRODUCT.md` |
| Structure overview | `PROJECT_STRUCTURE.md` |
| Local secrets (gitignored) | `.env.local` |
| Secrets template | `.env.example` |
| Supabase CLI link | `supabase/.temp/project-ref` → `ihmeziugudvklybedxui` |
| Vercel CLI link | `.vercel/project.json` → `prj_TkZ2XVcFAKoMxxhdU9paUnpgeefu` |

There is also a superseded copy at
`C:\Users\vikram\Documents\Default Project\free-pool-radar-v1-archive`. It is
not maintained. Do not read it and do not copy from it.

`PRODUCT_ALIGN.md` is a one-line pointer to `PRODUCT.md`. Two copies of a spec
drift, and the copy nobody checks starts lying — the previous schema-shaped
`PRODUCT.md` claimed a light-theme default, seven providers and an
`app/api/snapshot` re-poll control, none of which matched the product.

---

## 2. Connections

| Service | Identifier | CLI state |
|---|---|---|
| Supabase project ref | `ihmeziugudvklybedxui` | linked |
| Vercel project | `free-pool-radar` (`prj_TkZ2XVcFAKoMxxhdU9paUnpgeefu`) | linked |
| Vercel team | `team_ackbjSS8oQWAfHLFw67rMSQa` | |
| GitHub remote | `https://github.com/vikramdex-ops/free-pool-radar.git` | `main` |
| Live URL | `https://free-pool-radar.vercel.app` | |

Both CLIs are already authenticated on this machine. If they are not on a new
one: `npx supabase login` and `npx vercel login`.

Toolchain: Node v26.7.0, npm 11.19.0, Supabase CLI 2.118.0, Vercel CLI 59.10.0.

### Environment variables

| Name | Consumer | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | frontend + edge | public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | frontend reads | public, safe |
| `SUPABASE_SECRET_KEY` | `lib/admin-db.ts` | **server only** |
| `ADMIN_PASSWORD` | `lib/auth.ts` | **server only** |
| `ADMIN_SESSION_SECRET` | `lib/auth.ts` | **server only** |
| `NEXT_PUBLIC_SITE_URL` | canonical URLs | public |

All six are set in Vercel for production. Locally they live in `.env.local`,
which is gitignored and untracked. `.env.example` documents each one and why.

**Two credentials are already disclosed and must be rotated.** Both appear in
plaintext in prior chat transcripts: the Supabase secret key and the current
admin password. See §7.

---

## 3. Architecture, in one paragraph

Supabase Postgres is the engine. A `pg_cron` job ticks hourly and calls
`tick_radar_sweep`, which fires when five hours have elapsed since the last run;
that in turn calls a `pg_net` request to the `radar-sweep` Edge Function, which
fans out to twelve collectors, diffs the results against the database, and
records observations and changes through set-based reconciliation RPCs. The
Next.js frontend is a reader only — it holds no intelligence of its own, which
is why a data change reaches the public site with no redeploy.

---

## 4. Commands

### Everyday

```bash
cd "C:\Users\vikram\Documents\Default Project\free-pool-radar"

npm run dev          # dev server
npm run build        # production build
npx tsc --noEmit     # types
npx next start -p 3133   # serve a build (set env first — see gotcha 5.4)
```

### Database

```bash
# Apply new migrations
npx supabase db push --linked

# Run ad-hoc SQL remotely. No DB password needed.
npx supabase db query --linked --file scripts/some-check.sql

# Redeploy the sweep
npx supabase functions deploy radar-sweep --project-ref ihmeziugudvklybedxui
```

### Deploy

```bash
npx vercel --prod --yes
npx vercel env ls          # confirm variables are present
```

**Merging to `main` does not deploy.** As of 2026-09-30 the Vercel project is
not connected to this GitHub repository: the repo has zero GitHub deployments
and zero commit statuses. Production only changes when someone runs
`vercel --prod` with an authenticated CLI. Do not assume a merge went live —
check `https://free-pool-radar.vercel.app/robots.txt` returns 200 and that the
response carries a `Content-Security-Policy` header. Both are absent on any
build older than CIP-003/PUL-001.

### Verify

```bash
# Pages x themes x viewports: console errors, overflow, status codes
node scripts/verify.mjs

# Auth, search, events, filters and sorting (27 checks, needs a local server)
$env:ADMIN_PASSWORD="<from .env.local>"
node scripts/test-new-routes.mjs

# The same internal routes against the real deployment (8 checks)
node scripts/test-prod-auth.mjs

# Acceptance suite. Tests 1-3 need the fixture seeded first; see gotcha 5.6.
node scripts/acceptance.mjs
```

Run the Playwright scripts from the **parent** directory, or with the repo's own
scripts by absolute path — Playwright is installed one level up, not in this
project.

---

## 5. Gotchas that will cost you time

These are the ones that have actually bitten. Each was found the hard way.

**5.1 PostgREST caches the schema.** After DDL, a new or changed RPC can return
`PGRST202` or, worse, silently run a superseded definition. Every migration ends
with `select pg_notify('pgrst', 'reload schema')`, and `scripts/reload-postgrest.sql`
does the same by hand. The notify alone has been unreliable before; if a function
misbehaves, assume the cache and reload.

**5.2 `supabase db query` shows context; PostgREST does not.** The CLI surfaces
`CONTEXT` with the failing statement and the plpgsql line number. A PostgREST
call returns only a bare message. When a function misbehaves, test it through
`db query` first.

**5.3 PowerShell and UTF-8.** `Set-Content -Encoding utf8` writes a BOM, which
breaks the Supabase CLI's environment parsing. `git show > file` writes UTF-16,
which silently mangles a README. To write UTF-8 without a BOM:

```powershell
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
```

`scripts/fix-mojibake.mjs` repairs damage from this. It uses exact sequence
replacement, not whole-file decoding, because files are mixed — intact and
damaged characters sit side by side, and a whole-file decode corrupts what was
already correct. That mistake was made and reverted once. Run
`scripts/list-chars.mjs` first to see what is actually present.

**5.4 Env vars must be in `.env.local`, not just the shell.** Setting
`$env:SUPABASE_SECRET_KEY` before `npx next start` did not reach the server in
practice. Put it in `.env.local`, which is what Next loads. The symptom is
misleading: `/admin` reports "no server-side database credential is configured"
while `/discovery`, using the same helper, works fine.

**5.5 A page with no `force-dynamic` and no cookie read gets prerendered.** The
admin page was silently baked at build time — with no credentials present — and
served that frozen HTML indefinitely, claiming the source registry was empty
while twelve sources were registered. Any page reading live data, or anything
behind auth, needs `export const dynamic = "force-dynamic"` **and** a session
assertion. A local build passing proves nothing here; test the deployment.

**5.6 Acceptance tests 1–3 need a fixture.** They write a synthetic offer into
the production database and were deliberately removed. To run them:
`npx supabase db query --linked --file scripts/acceptance-fixture.sql`, then
`scripts/acceptance-cleanup.sql` afterwards. Never leave the fixture in place.

**5.7 Wide nullable `VALUES` lists.** Postgres reports "VALUES lists must all
be the same length" without naming the row. `scripts/check-seed.mjs` exists
because this repeatedly wasted time.

**5.8 The harness browser has no visible window.** Use `scripts/shot.mjs` and
`scripts/verify.mjs` for screenshots, not the browser tool's screenshot.

---

## 6. Layout

```
app/                     routes; api/ holds eight JSON endpoints
components/              presentation only
lib/db.ts                public read client (anon) and every query
lib/auth.ts              session signing and verification
lib/admin-db.ts          elevated client — /admin and /discovery only
lib/search.ts            §30 search, including the recognised-term table
lib/format.ts            units verbatim, UTC dates, freshness, NOT_STATED
middleware.ts            gates /admin and /discovery
supabase/migrations/     0001–0012, applied
supabase/functions/      radar-sweep Edge Function (12 collectors)
supabase/seed.sql        researched baseline, idempotent
scripts/                 verification, diagnostics, and repair tooling
```

Public routes: `/`, `/live`, `/search`, `/events`, `/events/[slug]`,
`/providers`, `/providers/[slug]`, `/models`, `/models/[slug]`, `/compare`,
`/timeline`, `/evidence/[id]`, `/methodology`.
Internal: `/admin`, `/admin/login`, `/discovery`.

Live data as of handover: 134 free routes, 39 providers, 113 models, 20
discovery candidates, 12 sources.

---

## 7. Outstanding work

### Every PR is closed — do not reopen #7, #11 or #13

All fourteen PRs are accounted for: eleven merged, three closed with a note
explaining where their code landed. `main` is `3b5c258`.

The three branches behind the closed PRs — `fix/LED-001-read-errors`,
`fix/PUL-003-social-preview` and `fix/VIS-008-methodology-observations` — have
been **deleted on the remote**. Their commits were rebased or force-pushed after
their content was already cherry-picked to `main`, which left them holding a
pre-batch tree snapshot while still appearing "ahead of main" to `git rev-list`.
Merging any of them would have deleted the licence files, robots.txt, sitemap,
CSP config, login throttle, JSON-LD and seven test scripts. That is the failure
mode to expect from a stale branch in this repo, and the reason the branches are
gone rather than merely closed. If you were working on one of them, start again
from `origin/main`.

### LED-020 is approved — build it, with these constraints

`observations.source_id` is never written by the reconcile insert, so no
observation row can be traced to the source it came from. Verified live: all
rows have a NULL `source_id`. Build the fix. Constraints:

1. **Insert-time lookup is the real fix.** Resolve the source id from the
   collected payload inside the reconcile insert so new rows are attributed at
   write time.
2. **Backfill is best-effort and must be marked as such.** Host- or
   URL-matching the offer's provider to a source is a heuristic, not proof. Add
   a column recording that `source_id` was inferred rather than written, and
   leave `source_id` NULL wherever the match is not unambiguous. A wrong
   provenance is worse than a missing one — invariant 2 is exactly this.
3. Do not end offers, delete rows, or touch `last_verified_at`.

There is a second reason this matters, found while verifying VIS-008. Of the 7
observations, 6 sit inside a sweep with `offers_changed > 0` — which is what
proves the methodology page was overstating. The 7th, observation id 22 at
`2026-09-29 09:20:15Z`, sits between sweep 14 (`09:18:21`, `offers_changed = 0`)
and sweep 15 (`09:22:25`, `offers_changed = 1`), and matches neither. Until
`source_id` exists it is not possible to say which sweep or which source wrote
it. Fixing provenance resolves this too; papering over it does not.

VIS-008 itself is closed and correct: `0005_set_based_reconcile.sql:43-45`
states that returning no rows from `rpc_offer_changes` "is what makes a repeated
sweep a complete no-op", and the live data agrees — 23 sweeps, 4 with changes,
7 observations. The wording was wrong, not the pipeline.

### Work in a worktree, never the shared checkout

Eight agents share `C:\Users\vikram\Documents\Default Project\free-pool-radar`.
A `git checkout` there deletes another agent's uncommitted work, and this has
already destroyed work twice. Use:

```bash
git worktree add C:\Temp\opencode\wt-<agent> -b <branch> origin/main
```

Turbopack rejects a `node_modules` junction that points outside the project
root, so copy the directory rather than junctioning it:
`robocopy <repo>\node_modules <worktree>\node_modules /E /NFL /NDL /NJH /NJS /NP /MT:16`.
Playwright lives one level above the repo, so `scripts/verify.mjs` only resolves
it when run from the repo directory — start the server from the worktree and run
verify from the repo with `BASE=http://localhost:<port>`.

### Rotate the Supabase secret key
**Rotate the Supabase secret key.** It is in plaintext in prior chat transcripts
and must be treated as disclosed. In the Supabase dashboard, create a new secret
key, then:

1. Update the vault entry — `supabase/vault.sql`, secret name
   `supabase_secret_key`.
2. `npx vercel env rm SUPABASE_SECRET_KEY production`, then add the new value.
3. `npx supabase functions deploy radar-sweep --project-ref ihmeziugudvklybedxui`
4. Confirm a sweep still runs: `radar_status` view, or the admin page.

**Rotate the admin password.** The current value is in `.env.local` and was
printed to a chat transcript. Change both `ADMIN_PASSWORD` and
`ADMIN_SESSION_SECRET` on Vercel; the second invalidates existing sessions.

**`freetheai.health` no longer resolves.** NXDOMAIN from two independent
resolvers, while `health` itself resolves — so the resolver is fine and there
are simply no records. The source registry still records "HTTP 530" from the
last sweep, which is a different failure and now stale. The invariant held: both
FreeTheAI offers kept their last verified values and none were ended. Left alone
deliberately.

**Spec gaps not yet built.** §38 alerts, §39 pro features, §53 AI research
agent, §75 SEO content pages, §86 MCP server. Phase 5–6 material.

---

## 8. Invariants — do not break these

These are the product. A change that breaks one is a regression even if every
test passes.

1. **Never rank.** No "best", "top", "worst", "#1". §3, §32. Sort orders are
   named for what they sort by, and every order pushes missing values last.
2. **Never invent a figure.** If a provider does not publish something, it reads
   "not stated". Never substitute a third-party number.
3. **A failed source must never end its offers.** Offers keep their last
   verified values and age into staleness. A source that is down is not an offer
   that ended — this is the single worst failure this product could have.
4. **Never delete history.** Ended offers, rejected candidates and superseded
   decisions are all kept. `discovery_candidate_decisions` is append-only.
5. **Colour conveys state only.** Green live, amber upcoming/change, red
   ended/problem, grey stale, blue/white neutral.
6. **Units are verbatim.** A pool denominated in dollars must never be labelled
   as tokens. §56.
7. **Times are UTC.** Formatted once, in `lib/format.ts`.
8. **No redeploy for a data change.** §76. The frontend reads; it never holds
   data of its own.
9. **A failed read is never rendered as an empty result.** Say it could not be
   read. An operational page claiming a registry is empty when it is not is the
   failure mode most worth avoiding.
