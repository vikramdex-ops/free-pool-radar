#!/usr/bin/env node
/**
 * Free Pool Radar — MCP server.
 *
 * A dependency-free Model Context Protocol server over stdio (newline-delimited
 * JSON-RPC 2.0). It answers questions like "find me a currently free API for a
 * reasoning model" using the public, evidence-backed API — no key, no database
 * credentials.
 *
 * Why no SDK: this repository installs nothing it does not need, and the stdio
 * transport is small enough to implement directly and test in CI. If a future
 * maintainer prefers the official SDK, the tool definitions below are the part
 * that carries the value and can be lifted across unchanged.
 *
 * Environment:
 *   RADAR_BASE_URL   default https://free-pool-radar.vercel.app
 */
import { createInterface } from "node:readline";

const BASE = (process.env.RADAR_BASE_URL ?? "https://free-pool-radar.vercel.app").replace(/\/+$/, "");
const PROTOCOL_VERSION = "2025-06-18";
const SERVER = { name: "free-pool-radar", version: "1.0.0" };

/* ------------------------------------------------------------------ */
/* upstream reads                                                      */
/* ------------------------------------------------------------------ */

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Upstream ${path} did not return JSON (HTTP ${res.status})`);
  }
  if (!res.ok) {
    // A failed read is never an empty result — surface it.
    throw new Error(body?.message ?? `Upstream ${path} returned HTTP ${res.status}`);
  }
  return body;
}

/** Compact an offer to the fields an agent actually needs. */
function brief(o) {
  return {
    provider: o.provider,
    providerSlug: o.providerSlug,
    model: o.model,
    modelId: o.modelId ?? null,
    access: o.offerType,
    status: o.status,
    cardRequired: o.cardRequired,
    paymentRequired: o.paymentRequired,
    keyless: o.keyless,
    compatibility: [
      o.compatibility?.openai ? "openai" : null,
      o.compatibility?.anthropic ? "anthropic" : null,
    ].filter(Boolean),
    limits: o.limits,
    pool: o.pool,
    verified: o.lastVerifiedAt,
    verificationLevel: o.verificationLevel,
    source: o.officialEvidenceUrl ?? o.secondaryEvidenceUrl ?? null,
    providerUrl: o.providerUrl,
  };
}

/* ------------------------------------------------------------------ */
/* tools                                                               */
/* ------------------------------------------------------------------ */

const TOOLS = [
  {
    name: "search_free_routes",
    description:
      "Find currently usable free AI inference routes. Filter by a free-text query (matches provider or model), a model substring, or an access type. Returns evidence-backed offers with quotas and verification times.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free text matched against the provider and model names." },
        model: { type: "string", description: "Substring matched against the model label or id." },
        access: {
          type: "string",
          description: "Access type filter.",
          enum: [
            "shared_pool", "free_tier", "rotating_free_model", "sponsored_inference",
            "promotional_event", "free_credits", "keyless", "free_trial",
          ],
        },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Max results (default 10)." },
      },
    },
  },
  {
    name: "get_provider",
    description: "Look up one provider by name or slug: its registry row and every currently live free route it offers.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Provider name or slug, case-insensitive." },
      },
      required: ["provider"],
    },
  },
  {
    name: "list_changes",
    description: "Recent changes from the append-only change log: new pools, quota changes, withdrawals and status changes.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Filter by change type.",
          enum: [
            "new", "model_added", "model_removed", "quota_increased", "quota_decreased",
            "pool_started", "pool_exhausted", "pool_extended", "pool_cancelled",
            "price_changed", "card_required", "card_removed", "subscription_required",
            "subscription_removed", "free_tier_started", "free_tier_ended",
            "rate_limit_changed", "status_changed",
          ],
        },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Max results (default 25)." },
      },
    },
  },
  {
    name: "get_stats",
    description: "Headline counts for the radar: live free routes, providers, models, source health and the verification cycle.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_ended",
    description: "Free access that has been withdrawn, retained permanently for historical reference.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Max results (default 25)." },
      },
    },
  },
];

async function callTool(name, args = {}) {
  switch (name) {
    case "search_free_routes": {
      const { data } = await api("/api/live");
      const q = (args.query ?? "").toLowerCase();
      const m = (args.model ?? "").toLowerCase();
      let rows = data.filter((o) => o.status === "live");
      if (q) rows = rows.filter((o) => `${o.provider} ${o.model}`.toLowerCase().includes(q));
      if (m) rows = rows.filter((o) => `${o.model ?? ""} ${o.modelId ?? ""}`.toLowerCase().includes(m));
      if (args.access) rows = rows.filter((o) => o.offerType === args.access);
      const limit = clamp(args.limit, 10, 50);
      return { count: rows.length, returned: Math.min(rows.length, limit), routes: rows.slice(0, limit).map(brief) };
    }
    case "get_provider": {
      const needle = String(args.provider ?? "").toLowerCase();
      const [{ data: providers }, { data: offers }] = await Promise.all([
        api("/api/providers"),
        api("/api/live"),
      ]);
      const p = providers.find(
        (x) => x.name.toLowerCase() === needle || x.slug.toLowerCase() === needle,
      ) ?? providers.find(
        (x) => x.name.toLowerCase().includes(needle) || x.slug.toLowerCase().includes(needle),
      );
      if (!p) return { found: false, provider: args.provider, hint: "No provider matched. Try /api/providers for the registry." };
      const live = offers.filter((o) => o.providerSlug === p.slug);
      return { found: true, provider: p, liveRoutes: live.map(brief) };
    }
    case "list_changes": {
      const limit = clamp(args.limit, 25, 100);
      const qs = new URLSearchParams({ limit: String(limit) });
      if (args.type) qs.set("type", args.type);
      const body = await api(`/api/changes?${qs.toString()}`);
      return { count: body.count, generatedAt: body.generatedAt, changes: body.data };
    }
    case "get_stats": {
      const body = await api("/api/stats");
      return body.data;
    }
    case "get_ended": {
      const limit = clamp(args.limit, 25, 100);
      const body = await api("/api/ended");
      return { count: body.count, returned: Math.min(body.data.length, limit), ended: body.data.slice(0, limit).map(brief) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function clamp(v, def, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(max, Math.trunc(n)));
}

/* ------------------------------------------------------------------ */
/* JSON-RPC framing                                                    */
/* ------------------------------------------------------------------ */

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  // Notifications carry no id and get no response.
  const isRequest = msg.id !== undefined && msg.id !== null;

  switch (msg.method) {
    case "initialize":
      return result(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER,
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return; // notification: no reply
    case "ping":
      return result(msg.id, {});
    case "tools/list":
      return result(msg.id, { tools: TOOLS });
    case "tools/call": {
      const { name, arguments: args } = msg.params ?? {};
      try {
        const value = await callTool(name, args);
        return result(msg.id, {
          content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        });
      } catch (err) {
        // A tool failure is a tool result with isError, not a protocol error,
        // so the model can see what went wrong and adapt.
        return result(msg.id, {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        });
      }
    }
    default:
      if (isRequest) return error(msg.id, -32601, `Method not found: ${msg.method}`);
      return; // unknown notification: ignore
  }
}


let queue = Promise.resolve();

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    error(null, -32700, "Parse error");
    return;
  }
  // Serialise handling so responses preserve request order even though the
  // tool calls await network I/O.
  queue = queue.then(() => handle(msg)).catch((err) => {
    if (msg && msg.id != null) error(msg.id, -32603, String(err));
  });
});

