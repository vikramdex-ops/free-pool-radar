# Datasets

The collected data is open under **CC0 1.0 Universal** — public domain, no
attribution required, no restrictions. You do not need to credit Free Pool Radar
to use it (though it is appreciated and helps others find the project).

The code that produces it is MIT-licensed. See [LICENSE](LICENSE) and
[DATA-LICENSE](DATA-LICENSE).

---

## Downloads

| Path | Format | Contents |
|---|---|---|
| `/api/dataset` | JSON | Everything, one document |
| `/data/latest.json` | JSON | The combined latest snapshot |
| `/data/latest.csv` | CSV | The same snapshot, offers flattened |
| `/feed.xml` | Atom | Recent changes as a feed |
| `/api/live` | JSON | Live routes only |
| `/api/providers` | JSON | Registry only |
| `/api/models` | JSON | Models only |
| `/api/changes` | JSON | The change log |

```bash
curl https://free-pool-radar.vercel.app/api/dataset -o radar.json
curl https://free-pool-radar.vercel.app/data/latest.csv -o radar.csv
```

---

## The snapshot document

`/api/dataset` and `/data/latest.json` return:

```json
{
  "generatedAt": "2026-10-08T07:09:00.000Z",
  "verificationCycleHours": 5,
  "sources": { "total": 12, "ok": 11, "impaired": 1 },
  "lastSweepAt": "2026-10-08T07:07:00.193729+00:00",
  "nextSweepAt": "2026-10-08T12:07:00.193729+00:00",
  "counts": {
    "offers": 153,
    "providers": 39,
    "models": 133,
    "events": 2,
    "ended": 9
  },
  "data": {
    "live": [ ... ],
    "ended": [ ... ],
    "upcoming": { "offers": [ ... ], "events": [ ... ] },
    "providers": [ ... ],
    "models": [ ... ],
    "events": [ ... ]
  }
}
```

Each array uses the same shape as its corresponding endpoint — see
[API.md](API.md).

---

## Enumerations

**Status** (`offers.status`): `upcoming`, `live`, `changed`, `ending`,
`exhausted`, `ended`, `suspended`, `unverified`.

**Access type** (`offers.offerType`): `shared_pool`, `free_tier`,
`rotating_free_model`, `sponsored_inference`, `promotional_event`,
`free_credits`, `keyless`, `free_trial`, `ended`.

**Verification level** (`offers.verificationLevel`): `live_api`, `official_docs`,
`official_event_page`, `official_announcement`, `official_social`, `secondary`,
`community`.

**Change type** (`changes.changeType`): see [API.md](API.md#filters).

---

## CSV columns

`/data/latest.csv` flattens the live offer set to one row per offer:

| Column | Meaning |
|---|---|
| `id` | Offer id |
| `provider` | Provider name |
| `provider_slug` | Provider slug |
| `model` | Model label |
| `model_id` | Model id, if known |
| `status` | Offer status |
| `offer_type` | Access type |
| `card_required` | `true`/`false` |
| `payment_required` | `true`/`false` |
| `api_key_required` | `true`/`false` |
| `keyless` | `true`/`false` |
| `rpm`,`rpd`,`tpm`,`tpd` | Rate limits (empty when not published) |
| `pool_size`,`pool_remaining`,`pool_unit` | Shared-pool figures |
| `credit_amount`,`credit_currency` | Credit offers |
| `start_at`,`end_at` | ISO 8601 |
| `verification_level` | Evidence level |
| `official_evidence_url` | Primary source |
| `last_verified_at` | ISO 8601 |
| `provenance` | `observed` or `researched` |

Empty cells mean **not publicly stated** — not zero.

---

## Atom feed

`/feed.xml` is an Atom 1.0 feed of recent changes. Point any reader at:

```text
https://free-pool-radar.vercel.app/feed.xml
```

Each entry is one change: a new pool, a quota change, a new model, or a
withdrawal. Use it to build notifications without polling the API. There is no
hosted webhook endpoint — the feed is the subscription surface, and a relay of
your own turns it into Discord, Slack or Telegram messages.

---

## Citing this dataset

Not required, but if you write about it, please include the retrieval date and
link the live site so readers can check the current figures:

> Free Pool Radar (retrieved 2026-10-08), https://free-pool-radar.vercel.app

Figures change. A dated citation is the honest one.
