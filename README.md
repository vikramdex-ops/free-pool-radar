# Free Pool Radar

**Every free AI inference route, verified live, with the receipts. Never ranked.**

![Free Pool Radar: live dial and verified routes](docs/hero.png)

<!-- STATS:START -->

| 🟢 Free routes | 🏢 Providers | ↗ Models | 👀 Sources | 🕐 Cycle | ✅ Last verified |
|---:|---:|---:|---:|---:|---|
| **156** | **39** | **136** | 11 / 12 | every 5h | 09 OCT 2026 · 08:07 UTC |

<!-- STATS:END -->

Figures are read live from `/api/stats` (see the workflow). If a number looks stale, open an issue — never hand-edit a README figure.

[Live site](https://free-pool-radar.vercel.app)
· [Providers](https://free-pool-radar.vercel.app/providers)
· [Live now](https://free-pool-radar.vercel.app/live)
· [Timeline](https://free-pool-radar.vercel.app/timeline)
· [Methodology](https://free-pool-radar.vercel.app/methodology)
· [API](#public-api)
· [MCP](#use-it-from-your-coding-agent)

Free AI API lists go stale in a week and never tell you *which kind* of free. This one re-checks official sources every five hours, shows the proof behind each number, and keeps the record on both sides — when a free tier appears and when it disappears.

- **For developers:** what can I call for $0 right now, with what limits, and does it need a card?
- **For agent builders:** a REST API, JSON/CSV datasets, an Atom feed and an MCP server.
- **For researchers:** an append-only history of free-tier launches and withdrawals, licensed CC0.

## Try it in 30 seconds

```bash
curl https://free-pool-radar.vercel.app/api/live | jq '.data[0]'
```

## Use it from your coding agent

Add the MCP server so your agent can answer "find me a free reasoning model with no card" from live data. Tools: `search_free_routes`, `get_provider`, `list_changes`, `get_stats`, `get_ended`. Setup is in [MCP.md](MCP.md).

## How this was built

I don't write code. I built this by directing AI coding agents, and I'm not hiding that. What I did write is the rulebook: a product spec of things the site must never do — invent a number, call a failed fetch an ended offer, convert units, delete history, rank providers — plus automated checks that enforce them. The code is public, MIT licensed, and I'd like it read critically. If you find a bug or a wrong figure, open an issue.

If this saved you time, a star helps other people find it.

## It's infrastructure, not a webpage

