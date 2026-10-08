# Methodology

The README sells the project. This file defends it.

Everything below is a rule the system **enforces** — in the schema, the stored
procedures or the collector — not a statement of good intentions. If a rule
here and the code disagree, the code is wrong and the rule wins.

The user-facing version of this document is at
[`/methodology`](https://free-pool-radar.vercel.app/methodology).

---

## The core claim

**"Free" is not a category. It is a claim, and no claim is published without
evidence.**

Free can mean a permanent tier, a daily quota, a shared pool, a promotional
event, expiring credits, a trial, or a card-gated allowance. A tracker that
collapses those into one badge is not simplifying the truth — it is replacing
it. Free Pool Radar keeps the distinctions and records the evidence for each.

---

## The evidence hierarchy

Every factual claim carries a source, and sources are ranked. A figure read
from a live endpoint outranks a figure read from a provider's documentation,
which outranks a dated announcement, which outranks a social post, which
outranks a third-party write-up or a community report.

| Level | Source | Can it verify an offer? |
|---|---|---|
| `live_api` | A public models, quota or JSON endpoint | ✅ strongest — cannot quietly disagree with reality |
| `official_docs` | The provider's own stated limits and terms | ✅ |
| `official_event_page` | A published pool or promotion, with dates and size | ✅ |
| `official_announcement` | A dated blog post or changelog entry | ✅ |
| `official_social` | An account belonging to the provider | ✅ (weakest official) |
| `secondary` | Reputable third-party reporting | ⚠️ can **discover**, cannot verify |
| `community` | What a reader told us | ❌ enters the review queue, never the live list |

The level is a **named rank, not a numeric trust score**. There is no weighted
average and no confidence percentage presented to a reader as fact.

---

## One claim, one primary status

Every offer carries exactly one status:

`upcoming` · `live` · `changed` · `ending` · `exhausted` · `ended` ·
`suspended` · `unverified`

**Access type is tracked separately**, because an offer can be a shared pool
that is *also* rate limited and *also* card-gated:

`shared_pool` · `free_tier` · `rotating_free_model` · `sponsored_inference` ·
`promotional_event` · `free_credits` · `keyless` · `free_trial` · `ended`

Collapsing those into a single "free" badge would hide the only information
anyone actually needs.

---

## Numbers are never invented

- Every important numeric field stores its **value**, its **source URL**, when
  it was **observed**, and its **evidence level**.
- If a provider does not publish a limit, the field is `NULL` and renders as
  **"not publicly stated"**. Never a zero, never a guess.
- A rate limit is never inferred from observed behaviour.
- A figure is never carried across from a different tier or a different region.
- **Units are reproduced exactly as published.** A pool quoted in *weighted
  tokens* is labelled weighted tokens, not tokens. Requests, tokens, credits,
  dollars, neurons and GPU-seconds are never converted into one another,
  because the conversion is not ours to make.

---

## A failed source is not a withdrawn offer

**This is the rule held most firmly, and the single most important invariant in
the codebase.**

When a source cannot be reached, the failure is recorded against *the source* —
never against its offers. The offers are left exactly as they were. Their
verification time ages, and they move through the freshness bands (`fresh`,
`aging`, `stale`, `very_stale`) as it does. **Nothing is marked ended because a
request timed out, returned a 500, or the provider changed its CDN.**

A source that fails repeatedly is shown as *failed*, alongside the time of its
last successful verification, so a reader can tell the difference between "this
ended" and "we have not been able to check".

The guard that enforces this lives in the database, not only in the collector:

```sql
-- rpc_update_offer
where o.id = (p->>'id')::bigint
  and not (o.status = 'ended' and coalesce(p->>'status','') <> 'ended')
```

An ended offer cannot be revived by a source that still reports it, and a
failed fetch never reaches this statement at all.

---

## Conflicts are preserved

When two official sources disagree, **both readings are stored and both are
displayed**. OpenRouter documents 50 requests a day for unfunded accounts and
1,000 after ten dollars of lifetime credit. Those are not a contradiction; they
are two conditions, and the honest rendering is the condition, not a single
averaged number. A conflict is never resolved by quietly choosing a side.

---

## History is never deleted

- A sweep **appends an observation** when the collected payload differs from
  the stored one.
- A byte-identical payload is a deliberate no-op: it refreshes
  `last_verified_at` and appends nothing, so repeated sweeps cannot inflate the
  history.
- Append-only change detection records one row per detected difference between
  two sweeps.
- An offer that ends is **retained** with its end date, the reason and the
  evidence.

Chutes retired its free tier in March 2026. GitHub Models went dark in July.
Both are still on the record, because "does this provider have a free tier" is
a question that gets *more* useful when the site remembers.

---

## Provenance of each row

Rows carry a provenance marker. An offer confirmed by an automated source a few
hours ago is one thing; an offer established by documented research for a
provider not yet polled automatically is another. Both are published, and both
are labelled — presenting one as the other would be the quiet overstatement
this product exists to avoid.

---

## What this project will not do

- Rank providers, or publish a quality score.
- Call a time-boxed trial "free" without saying when it ends.
- Present a promotional credit as equivalent to pooled tokens.
- Republish a third-party list without verifying each entry.
- Hide a conflict by picking a side.
- Fill an empty state with invented data.
- Delete a record because an offer ended.

---

## Independence

Free Pool Radar is an independent information service and is not affiliated
with, endorsed by, or sponsored by any provider listed. It takes no payment from
providers, accepts no affiliate links, and has no commercial relationship with
any entry in the database.

Free access can be withdrawn, rate-limited, modified or exhausted without
notice. Always review the provider's current terms, privacy policy and usage
restrictions before sending sensitive or production data. All timestamps are
UTC.
