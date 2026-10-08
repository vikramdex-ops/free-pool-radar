# Ecosystem

Free Pool Radar is meant to be built on. This file (and the
[`/ecosystem`](https://free-pool-radar.vercel.app/ecosystem) page) lists
first-party surfaces and community projects.

## First-party

| Project | Type | Where |
|---|---|---|
| Free Pool Radar API | REST | [`/api`](API.md) |
| Free Pool Radar datasets | JSON / CSV | [DATASET.md](DATASET.md) |
| Free Pool Radar feed | Atom | [`/feed.xml`](DATASET.md#atom-feed) |
| Free Pool Radar MCP | MCP server | [MCP.md](MCP.md) |

## Community — wanted

These are good, self-contained projects. If you build one, open a PR adding it
below and to `app/ecosystem/page.tsx`.

| Project | Type | Status |
|---|---|---|
| FreePool CLI | CLI to query free routes from a terminal | 🟡 seeking contributor |
| Free Pool Discord bot | Announces new pools via webhook | 🟡 seeking contributor |
| Free AI Finder | Browser extension over the public API | 🟡 seeking contributor |
| Free Pool Telegram bot | Same, for Telegram | 🟡 seeking contributor |
| Radar newsletter | Weekly "what changed" from `/api/changes` | 🟡 seeking contributor |

## Add your project

1. Something that **uses** Free Pool Radar — a client, a bot, a dataset
   analysis, a frontend, a mirror.
2. Open a PR editing `ECOSYSTEM.md` and `app/ecosystem/page.tsx` with: the
   project name, its type, a link, and one honest sentence about what it does.
3. No ranking, no "best" language, no affiliate links.

Projects are listed by kind, not by popularity. There is no ordering beyond
first-party first.
