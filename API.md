# Public API

Read-only. No key. No account. The same data the website renders, from the same
stored rows, so an API consumer and a page reader can never see different
numbers.

Base URL: `https://free-pool-radar.vercel.app`

---

## Endpoints

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/live` | Currently usable free routes |
| `GET` | `/api/offers` | `307` redirect to `/api/live` (canonical) |
| `GET` | `/api/upcoming` | Announced pools and events |
| `GET` | `/api/ended` | Withdrawn access, retained permanently |
| `GET` | `/api/providers` | The provider registry |
| `GET` | `/api/models` | Every model seen on a free route |
| `GET` | `/api/events` | Pools and promotional events |
| `GET` | `/api/changes` | The append-only change log |
| `GET` | `/api/stats` | Headline counts + verification cycle |
| `GET` | `/api/dataset` | The entire dataset, one document |
| `GET` | `/feed.xml` | Atom feed of recent changes |

`/api/offers` is an alias that **redirects** to `/api/live` rather than serving
a second copy — one body, nothing that can go stale independently.

---

## The response envelope

Every JSON endpoint returns the same envelope:

```json
{
  "data": [ ... ],
  "generatedAt": "2026-10-08T07:09:00.000Z",
  "count": 153,
  "sources": { "total": 12, "ok": 11, "impaired": 1 },
  "lastSweepAt": "2026-10-08T07:07:00.193729+00:00",
  "nextSweepAt": "2026-10-08T12:07:00.193729+00:00"
}
```

`sources`, `lastSweepAt` and `nextSweepAt` are present on the endpoints that
read offer data (`/api/live`, `/api/upcoming`). `count` is the number of rows in
`data`.

---

## Filters

`/api/changes` accepts two query parameters, both validated (never
interpolated):

| Parameter | Type | Notes |
|---|---|---|
| `type` | string | One of the change types below. Unknown values return `400`. |
| `limit` | integer | `1`–`500`, default `100`. A nonsense value falls back to `100`. |

Valid `type` values: `new`, `model_added`, `model_removed`, `quota_increased`,
`quota_decreased`, `pool_started`, `pool_exhausted`, `pool_extended`,
`pool_cancelled`, `price_changed`, `card_required`, `card_removed`,
`subscription_required`, `subscription_removed`, `free_tier_started`,
`free_tier_ended`, `rate_limit_changed`, `status_changed`.

```bash
curl "https://free-pool-radar.vercel.app/api/changes?type=card_required&limit=50" | jq '.count'
```

---

## Offer shape

`/api/live`, `/api/upcoming` and `/api/ended` return offers in this shape
(abridged — every field is always present, `null` where unknown):

```json
{
  "id": 2,
  "provider": "APMix",
  "providerSlug": "apmix",
  "providerUrl": "https://apmix.ai",
  "model": "gpt-luna-free",
  "modelId": null,
  "status": "live",
  "offerType": "shared_pool",

  "cardRequired": false,
  "paymentRequired": false,
  "subscriptionRequired": false,
  "apiKeyRequired": true,
  "keyless": false,

  "compatibility": { "openai": true, "anthropic": false, "other": null },

  "limits": {
    "rpm": null, "rpd": null, "tpm": null, "tpd": null,
    "monthlyLimit": null, "monthlyUnit": null,
    "tokenLimit": null, "tokenLimitUnit": null
  },

  "pool": { "size": 10000000000, "remaining": null, "unit": "weighted_tokens" },
  "credit": null,

  "startAt": "2026-10-01T17:00:00Z",
  "endAt": null,
  "exhaustionCondition": "Requests answer 403 event_ended once the pool is spent",

  "commercialUse": null,
  "dataPolicy": null,
  "retentionPolicy": null,

  "verificationLevel": "official_event_page",
  "officialEvidenceUrl": "https://apmix.ai/event",
  "secondaryEvidenceUrl": null,

  "firstDiscoveredAt": "2026-09-29T10:00:00Z",
  "firstVerifiedAt": "2026-09-29T10:00:00Z",
  "lastVerifiedAt": "2026-10-08T07:07:00Z",
  "lastVerifiedDisplay": "08 OCT 2026 · 07:07 UTC",
  "endedAt": null,

  "provenance": "observed"
}
```

`provenance` is `"observed"` for offers confirmed by an automated source and
`"researched"` for offers established by documented research.

---

## Status codes

| Code | Meaning |
|---|---|
| `200` | Success. |
| `307` | `/api/offers` redirect to `/api/live`. |
| `400` | An invalid `/api/changes?type=` value. |
| `503` | The database is not configured, **or** a read failed. A failed read is never rendered as an empty result. |

```json
{ "error": "read_failed", "message": "The live offers could not be read. This is a read failure, not an empty result." }
```

---

## Caching

Every endpoint sends:

```text
Cache-Control: public, s-maxage=300, stale-while-revalidate=60
```

The underlying data only changes every five hours, so a short shared cache costs
nothing. The SWR window is deliberately short so a recorded change is visible
promptly.

---

## Timestamps

All timestamps are ISO 8601 UTC. The editorial `08 OCT 2026 · 07:07 UTC` form
(`lastVerifiedDisplay`, `detectedDisplay`) is a presentation convenience and is
not the wire format — parse the ISO fields.

---

## Rate limits & etiquette

There is no key and no hard quota. The API is served from a shared cache. If you
poll frequently, prefer the [Atom feed](DATASET.md#atom-feed) or a conditional
request rather than a tight loop, and cache on your side for at least a few
minutes — nothing changes between sweeps.
