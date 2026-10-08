# MCP server

Free Pool Radar ships a **Model Context Protocol** server so coding agents
(Claude Code, OpenCode, Cursor, and any other MCP client) can answer questions
like *"find me a currently free API for a reasoning model"* mid-session — using
live, evidence-backed data instead of stale memory.

```text
Free Pool Radar
       │
       ├── Website
       ├── REST API
       ├── JSON / CSV datasets
       ├── Atom feed
       └── MCP server   ← this
```

The server is **dependency-free** and speaks JSON-RPC 2.0 over stdio. It reads
the public API over HTTP; it needs no key and no database credentials.

---

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `search_free_routes` | `query` (substring), `model`, `access`, `limit` | Matching live offers with provider, status, limits, evidence URL and verification time |
| `get_provider` | `provider` (name or slug) | One provider's registry row and its live offers |
| `list_changes` | `type`, `limit` | Recent changes from the append-only log |
| `get_stats` | — | Live counts and the verification cycle |
| `get_ended` | `limit` | Withdrawn access, retained permanently |

Example tool result:

```json
{
  "provider": "APMix",
  "model": "gpt-luna-free",
  "access": "shared_pool",
  "status": "live",
  "verified": "2026-10-08T07:07:00Z",
  "source": "https://apmix.ai/event"
}
```

---

## Running it

```bash
node mcp/server.mjs
```

Optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `RADAR_BASE_URL` | `https://free-pool-radar.vercel.app` | Point the server at your own deployment |

Smoke test (protocol handshake, no network):

```bash
node mcp/smoke.mjs
```

---

## Configure your client

**Claude Code / Claude Desktop** (`claude_desktop_config.json` or project MCP
config):

```json
{
  "mcpServers": {
    "free-pool-radar": {
      "command": "node",
      "args": ["/absolute/path/to/free-pool-radar/mcp/server.mjs"]
    }
  }
}
```

To point at your own radar:

```json
{
  "mcpServers": {
    "free-pool-radar": {
      "command": "node",
      "args": ["/absolute/path/to/free-pool-radar/mcp/server.mjs"],
      "env": { "RADAR_BASE_URL": "https://my-ai-radar.vercel.app" }
    }
  }
}
```

---

## Protocol notes

- Transport: **stdio**, newline-delimited JSON-RPC 2.0.
- Implements `initialize`, `notifications/initialized`, `tools/list`,
  `tools/call`, `ping`, and `notifications/cancelled`.
- Advertises protocol version `2025-06-18`.
- Errors are returned as JSON-RPC errors or as `isError: true` tool results;
  a failed upstream read is never reported as an empty result.

---

## Extending it

Ideas that would make good issues:

- Add a `compare_models` tool
- Add a resource template exposing `/api/live` as an MCP resource
- Add prompt templates ("recommend a free route for a task")
- Publish a bundled build so `npx` works without cloning

See [CONTRIBUTING.md](CONTRIBUTING.md).
