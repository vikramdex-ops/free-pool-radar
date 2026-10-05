// Scroll-performance acceptance for the revamp (APR-008).
//
// Replicates Forge's recorded baseline (production /live, headless Chromium,
// 1440px): p50 16.7ms, p95 16.8ms, max ~117 (single hitch), <=2 frames over
// 50ms across 120 frames, 1 backdrop-filter and 0 filters at rest.
// The revamp passes if p95 stays about 17ms and frames-over-50ms stay at 2
// or fewer. A long frame is a single rAF gap over 50ms.
//
// Run: BASE=http://localhost:3111 node scripts/perf-scroll.mjs [/live /]
// Needs only node and the Playwright-cached headless shell (no new
// dependencies - installing a driver to measure perf would itself change
// what is being reviewed). Skips honestly when the binary is absent; this
// is a localhost review instrument, not a CI gate (CI has no browser).
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PATHS = process.argv.slice(2).length ? process.argv.slice(2) : ["/live", "/"];
const FRAMES = 120;
const LONG_MS = 50;
const PORT = 9333;

const shellDir = join(
  process.env.LOCALAPPDATA ?? "",
  "ms-playwright",
  "chromium_headless_shell-1243",
  "chrome-headless-shell-win64",
  "chrome-headless-shell.exe",
);

if (!existsSync(shellDir)) {
  console.log("SKIP perf-scroll: headless-shell binary absent");
  process.exit(0);
}

function summarize(deltas) {
  const sorted = [...deltas].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    frames: deltas.length,
    p50: +pct(50).toFixed(1),
    p95: +pct(95).toFixed(1),
    max: +Math.max(...deltas).toFixed(1),
    over50: deltas.filter((d) => d > LONG_MS).length,
  };
}

const child = spawn(shellDir, [`--remote-debugging-port=${PORT}`, "--no-first-run"], {
  stdio: "ignore",
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(method, params = {}, id = 1) {
  const tabs = await (await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  return { ws: tabs.webSocketDebuggerUrl, id, method, params };
}

let failures = 0;
try {
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) {
    try {
      const v = await (await fetch(`http://localhost:${PORT}/json/version`)).json();
      ready = typeof v.Browser === "string";
    } catch {
      await sleep(500);
    }
  }
  if (!ready) throw new Error("debugger endpoint never came up");
  for (const path of PATHS) {
    const { ws } = await cdp();
    const socket = new WebSocket(ws);
    await new Promise((res, rej) => {
      socket.onopen = res;
      socket.onerror = rej;
    });
    let seq = 0;
    const pending = new Map();
    socket.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };
    const send = (m, p = {}) =>
      new Promise((res) => {
        const id = ++seq;
        pending.set(id, res);
        socket.send(JSON.stringify({ id, method: m, params: p }));
      });
    const evaluate = async (expression, awaitPromise = false) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
      if (r.result?.subtype === "error" || r.result?.result?.subtype === "error") {
        throw new Error(`evaluate failed: ${JSON.stringify(r.result).slice(0, 200)}`);
      }
      return r.result.result.value;
    };
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.enable");
    await send("Page.navigate", { url: BASE + path });
    await sleep(6000);
    const out = await evaluate(
      `(async () => {
        const counts = { elements: 0, backdrop: 0, filters: 0, transforms: 0 };
        const all = document.querySelectorAll("*");
        counts.elements = all.length;
        for (const el of all) {
          const cs = getComputedStyle(el);
          if (cs.backdropFilter !== "none") counts.backdrop++;
          if (cs.filter !== "none") counts.filters++;
          if (cs.transform !== "none") counts.transforms++;
        }
        const deltas = await new Promise((resolve) => {
          const ds = [];
          let last = performance.now();
          let n = 0;
          const floor = ${FRAMES};
          const maxY = Math.max(document.body.scrollHeight - innerHeight, 0);
          const step = Math.max(maxY / (floor - 1), 1);
          const tick = (t) => {
            ds.push(t - last);
            last = t;
            window.scrollTo(0, Math.min(n * step, maxY));
            if (++n >= floor) resolve(ds);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        return { deltas, counts };
      })()`,
      true,
    );
    const s = summarize(out.deltas);
    console.log(
      `${path}: frames=${s.frames} p50=${s.p50} p95=${s.p95} max=${s.max} ` +
        `over50ms=${s.over50} elements=${out.counts.elements} ` +
        `backdrop=${out.counts.backdrop} filters=${out.counts.filters} transforms=${out.counts.transforms}`,
    );
    const pass = s.p95 <= 20 && s.over50 <= 2;
    console.log(`${path}: ${pass ? "PASS" : "FAIL"} (bar: p95 about 17ms, over50ms at most 2)`);
    if (!pass) failures++;
    socket.close();
  }
} finally {
  child.kill();
}

if (failures > 0) {
  console.error(`\nperf-scroll: ${failures} path(s) outside the bar`);
  process.exit(1);
}
console.log("\nperf-scroll green: revamp holds the frame budget");
