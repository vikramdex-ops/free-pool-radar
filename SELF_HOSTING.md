# Self-hosting

Run your own Free Pool Radar — your own sources, your own database, your own
domain. No vendor lock-in, no proprietary crawler, no paid API required.

You need a free [Supabase](https://supabase.com) project, a
[Vercel](https://vercel.com) account, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

---

## 1. Fork and clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USER/free-pool-radar.git
cd free-pool-radar
npm install
```

## 2. Create a Supabase project

Create a project at [database.new](https://database.new), then collect three
values from **Project Settings → API**:

- the **Project URL** (`https://YOUR_PROJECT_REF.supabase.co`)
- the **publishable** key (`sb_publishable_...`)
- the **secret** key (`sb_secret_...`) — server-only, never in the browser

## 3. Push the schema and scheduler

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

This creates the six tables, RLS policies, the stored procedures, the
`pg_cron` schedule and the RPCs. Nothing here fetches data yet — it only builds
the container.

## 4. Store the secret key in Vault

The hourly tick calls the sweep function through `pg_net`, which needs to
authenticate. Put the project's secret key in **Supabase Vault** under the name
`supabase_secret_key`. See `supabase/vault.sql` for the one-time statement.

## 5. Deploy the collector

```bash
npx supabase functions deploy radar-sweep --no-verify-jwt
```

The function reads the secret from Vault, fetches each configured source,
reconciles, detects changes and returns a report. It never reads the secret from
the frontend's environment.

## 6. Seed the researched baseline

```bash
npx supabase db query --linked --file supabase/seed.sql
```

Optional: this gives you a starting set of providers and offers so the site is
not empty. The first sweep then takes over. To start from nothing instead, skip
this step and add your own sources.

## 7. Configure the frontend

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN.example
```

`NEXT_PUBLIC_SITE_URL` is important for a fork: without it, canonical URLs and
the sitemap would point at the upstream production origin. Set it to your own
domain so you are not emitting someone else's canonicals.

## 8. Run it locally

```bash
npm run dev
```

Open <http://localhost:3000>. The first sweep runs within the hour of the
scheduler being active.

## 9. Deploy to Vercel

1. Import your fork at [vercel.com/new](https://vercel.com/new).
2. Add the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`).
3. Deploy.

That is the whole engine. Your radar is live on your own domain.

---

## Adding your own sources

Collectors live in `supabase/functions/radar-sweep/core/collectors.ts` and the
sweep engine in `sweep.ts`. A collector fetches a provider's published pages or
endpoints and normalises the result into the pipeline's shape.

When you add a collector:

- Record the **source URL** and the **verification level** the source earns.
- **Never mark an offer ended because a fetch failed.** Record the failure
  against the source and leave offers untouched — see
  [METHODOLOGY.md](METHODOLOGY.md#a-failed-source-is-not-a-withdrawn-offer).
- Keep units verbatim. Do not convert a provider's units.
- A byte-identical payload must be a no-op (refresh `last_verified_at` only).

## Optional: admin and discovery

`/admin` and `/discovery` are internal pages gated behind a signed session
cookie. They stay closed unless both variables are set:

```env
SUPABASE_SECRET_KEY=sb_secret_...
ADMIN_PASSWORD=choose_a_password
ADMIN_SESSION_SECRET=<64 hex chars>
```

Generate the session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

With either admin variable unset, sign-in refuses and the routes stay closed —
they do not fall open.

## Rebuilding from scratch

`supabase/reset-data.sql` clears the collected data and leaves the schema,
policies, procedures and schedule intact.

---

## Keeping a fork current

Your fork is independent, but you can still take engine improvements:

```bash
git remote add upstream https://github.com/vikramdex-ops/free-pool-radar.git
git fetch upstream
git merge upstream/main
```

Because data and code are decoupled, merging engine changes never touches your
collected dataset.
