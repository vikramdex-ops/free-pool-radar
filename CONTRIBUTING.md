# Contributing

Fork the repo, make your changes in a branch, and open a pull request. CI runs on every pull request and on every push to `main`: it checks that your branch merges cleanly into `main`, typechecks, builds, and runs the offline checks in `scripts/` (see `.github/workflows/ci.yml`).

## The rules that matter more than usual here

This project's whole premise is that a list of "free AI APIs" is only useful if it's honest about what it doesn't know. That shapes what a good PR looks like:

- **Date every figure.** `as observed 2026-09-30`, or drop it. An undated number is indistinguishable from a guess six months later.
- **No ranking language.** No "best", "top", or quality scores. Sort orders are named for what they literally sort by (e.g. `context_length`), and missing values are pushed last, not hidden.
- **No star count, no vanity metrics.** There isn't one in this README on purpose — don't add one in a PR either.
- **A failed source is not an ended offer.** If you're touching a collector, the distinction between "could not verify" and "verified as withdrawn" is the single most important invariant in the codebase. See the `rpc_update_offer` guard in the README's "The rule that matters" section before changing anything near it.
- **Units are never converted.** Weighted tokens stay weighted tokens. Don't normalize a provider's own units to make entries easier to compare.

## Adding or correcting a provider

Open an issue (or a PR directly, if you're confident) with: the provider's official source URL, the exact free-tier terms as published, and the verification level that source earns (`live_api`, `official_docs`, `official_event_page`, `official_announcement`, `official_social`, `secondary`, or `community` — see the README's data model section). A correction to an existing entry should include what changed and why the old reading was wrong, not just the new number.

## Running it locally

See the README's "Running it locally" section — `npm install`, a Supabase project, `.env.local`, `npm run dev`. `node scripts/verify.mjs` should pass against a local server before you open a PR that touches the frontend.

## Repository metadata

Description: *A live radar of genuinely free AI inference — unranked, evidence-backed, never ranked.* Topics: `free-ai`, `api-tracker`, `open-data`, `postgres`, `vercel`, and similar — not `best`, `top`, or `ranking`.
