/**
 * MCP server smoke test.
 *
 * Starts mcp/server.mjs and performs the protocol handshake a real client does:
 * initialize, tools/list and ping. No network and no upstream calls — this
 * proves the server speaks the protocol and advertises its tools, which is the
 * class of failure a type check cannot see.
 *
 * Run: node mcp/smoke.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const server = spawn(process.execPath, [join(here, "server.mjs")], {
  stdio: ["pipe", "pipe", "pipe"],
});

const stderr = [];
server.stderr.on("data", (d) => stderr.push(String(d)));

const rl = createInterface({ input: server.stdout, crlfDelay: Infinity });
const inbox = [];
let waiter = null;
rl.on("line", (line) => {
  inbox.push(JSON.parse(line));
  if (waiter) {
    const w = waiter;
    waiter = null;
    w();
  }
});

async function next(timeoutMs = 5000) {
  const start = inbox.length;
  const deadline = Date.now() + timeoutMs;
  while (inbox.length <= start) {
    await new Promise((resolve) => {
      waiter = resolve;
      setTimeout(resolve, Math.min(50, Math.max(0, deadline - Date.now())));
    });
    if (Date.now() > deadline) throw new Error("timed out waiting for MCP response");
  }
  return inbox[inbox.length - 1];
}

function send(msg) {
  server.stdin.write(`${JSON.stringify(msg)}\n`);
}

try {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } },
  });
  const init = await next();
  assert.equal(init.id, 1);
  assert.ok(init.result, "initialize must return a result");
  assert.equal(init.result.serverInfo.name, "free-pool-radar");
  assert.ok(init.result.capabilities.tools, "server must advertise tools");
  console.log(`ok initialize (${init.result.protocolVersion})`);

  // A notification must not draw a reply.
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const list = await next();
  assert.equal(list.id, 2);
  const names = list.result.tools.map((t) => t.name);
  for (const required of ["search_free_routes", "get_provider", "list_changes", "get_stats", "get_ended"]) {
    assert.ok(names.includes(required), `tools/list must include ${required}`);
  }
  for (const t of list.result.tools) {
    assert.ok(t.description && typeof t.description === "string", `${t.name} needs a description`);
    assert.ok(t.inputSchema && t.inputSchema.type === "object", `${t.name} needs an object inputSchema`);
  }
  console.log(`ok tools/list (${names.length} tools)`);

  send({ jsonrpc: "2.0", id: 3, method: "ping" });
  const pong = await next();
  assert.equal(pong.id, 3);
  console.log("ok ping");

  send({ jsonrpc: "2.0", id: 4, method: "no/such/method" });
  const err = await next();
  assert.equal(err.error.code, -32601);
  console.log("ok unknown method returns -32601");

  console.log("\nMCP smoke: green");
  server.stdin.end();
  process.exit(0);
} catch (err) {
  console.error(`FAIL MCP smoke: ${err.message}`);
  if (stderr.length) console.error(stderr.join(""));
  server.kill();
  process.exit(1);
}
