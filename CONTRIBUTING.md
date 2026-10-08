# Contributing

Thanks for helping. Free Pool Radar is an open-source infrastructure project:
a radar, an API, a dataset and an MCP server. There is a contribution path for
almost every skill level.

- **Adding a provider or correcting data** → use the templates below.
- **Building something** (bot, CLI, extension) → see [ECOSYSTEM.md](ECOSYSTEM.md).
- **Changing the engine** → read [METHODOLOGY.md](METHODOLOGY.md) first; the
  rules there are enforced in the schema and the collector.

---

## Ways to contribute

| Want to | Do this |
|---|---|
| Add a provider | [➕ New provider](https://github.com/vikramdex-ops/free-pool-radar/issues/new?template=new-provider.yml) |
| Fix a changed figure | [🔄 Changed offer](https://github.com/vikramdex-ops/free-pool-radar/issues/new?template=changed-offer.yml) |
| Request a feature | [✨ Feature request](https://github.com/vikramdex-ops/free-pool-radar/issues/new?template=feature.yml) |
| Report a bug | [🐛 Bug report](https://github.com/vikramdex-ops/free-pool-radar/issues/new?template=bug_report.yml) |
| List a project | Edit [ECOSYSTEM.md](ECOSYSTEM.md) and `app/ecosystem/page.tsx` |
| Improve the docs | Edit the `.md` files at the repo root |

Good first issues are labelled `good first issue`. If you are unsure where to
start, open a discussion or ask on any issue.

---

## The rules that matter more than usual here

This project's premise is that a list of "free AI APIs" is only useful if it is
honest about what it does not know. That shapes what a good PR looks like:

- **Date every figure.** `as observed 2026-09-30`, or drop it. An undated number
  is indistinguishable from a guess six months later.
- **Cite a source, and rank it.** Every claim carries a
  [verification level](METHODOLOGY.md#the-evidence-hierarchy).
- **No ranking language.** No "best", "top", or quality scores. Sort orders are
  named for what they literally sort by, and missing values go last.
- **A failed source is not an ended offer.** If you touch a collector, this is
  the invariant that matters most. See
  [METHODOLOGY.md](METHODOLOGY.md#a-failed-source-is-not-a-withdrawn-offer)
  before changing anything near the `rpc_update_offer` guard.
- **Units are never converted.** Weighted tokens stay weighted tokens.
- **A missing number is `NULL`**, rendered as *not publicly stated* — never `0`.

---

## Adding or correcting a provider

Open an issue with the [new-provider](.github/ISSUE_TEMPLATE/new-provider.yml)
or [changed-offer](.github/ISSUE_TEMPLATE/changed-offer.yml) template. A
correction should include what changed and why the old reading was wrong, not
just the new number.

If you are changing a collector, also record the **source URL** and the
**verification level** for it, and make sure a byte-identical payload stays a
no-op (refresh `last_verified_at` only).

---

## Running it locally

See [SELF_HOSTING.md](SELF_HOSTING.md) — `npm install`, a Supabase project,
`.env.local`, `npm run dev`. Before opening a PR:

```bash
npx tsc --noEmit
node scripts/verify.mjs        # frontend changes; needs a local server
node mcp/smoke.mjs             # if you touched mcp/
```

CI runs on every PR: typecheck, a trial merge against `main`, the offline checks
in `scripts/`, the MCP smoke test, and a production build.

---

## Repository metadata

Description: *The open-source radar for genuinely free AI inference —
evidence-backed, unranked, history-preserving.*

Topics: `free-ai`, `api-tracker`, `open-data`, `postgres`, `vercel`, `mcp`,
`ai-infrastructure` — not `best`, `top`, or `ranking`.

A change is not done until it is merged and verified against the deployed site.
