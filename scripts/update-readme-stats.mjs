/**
 * Rewrites the README "Live right now" block from the deployed /api/stats.
 *
 * The README must never carry a stale figure as fact. This script reads the
 * live counts, formats them into the STATS block, and writes the file only when
 * the block actually changed — so a scheduled run that finds identical numbers
 * produces no commit.
 *
 * Usage:
 *   node scripts/update-readme-stats.mjs
 *   RADAR_BASE_URL=https://fork.example node scripts/update-readme-stats.mjs
 *
 * Exit codes:
 *   0  block updated, unchanged, or the API was unreachable (a scheduled run
 *      must not go red because the site is briefly down)
 *   1  the README's STATS markers are missing — a configuration error
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.RADAR_BASE_URL ?? "https://free-pool-radar.vercel.app").replace(/\/+$/, "");
const README = join(process.cwd(), "README.md");

const START = "<!-- STATS:START -->";
const END = "<!-- STATS:END -->";

const src = readFileSync(README, "utf8");
const startIdx = src.indexOf(START);
const endIdx = src.indexOf(END, startIdx + START.length);
if (startIdx === -1 || endIdx === -1) {
  console.error(`FAIL: README.md is missing ${START} / ${END} markers`);
  process.exit(1);
}

/** "2026-10-08T07:07:00.193729+00:00" -> "2026-10-08 07:07 UTC" */
function stamp(iso) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())} UTC`;
}

let stats;
try {
  const res = await fetch(`${BASE}/api/stats`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  stats = body.data;
  if (!stats || typeof stats.freeRoutes !== "number") {
    throw new Error("unexpected /api/stats shape");
  }
} catch (err) {
  console.warn(`::warning::could not read ${BASE}/api/stats (${String(err)}) — leaving README unchanged`);
  process.exit(0);
}

const lastVerified = stamp(stats.lastSweepAt);
const sources = stats.sources?.total ?? "?";
const cycle = stats.verificationCycleHours ?? 5;

const block = [
  START,
  "",
  "| 🟢 Free routes | 🏢 Providers | ↗ Models | 👀 Sources | 🕐 Cycle | ✅ Last verified |",
  "|---:|---:|---:|---:|---:|---|",
  `| **${stats.freeRoutes}** | **${stats.providers}** | **${stats.models}** | **${stats.sources?.ok ?? sources} / ${sources}** | every ${cycle}h | ${lastVerified} |`,
  "",
  END,
].join("\n");

const next =
  src.slice(0, startIdx) + block + src.slice(endIdx + END.length);

if (next === src) {
  console.log("README stats unchanged");
  process.exit(0);
}

writeFileSync(README, next);
console.log(`README stats updated: ${stats.freeRoutes} routes · ${stats.providers} providers · ${stats.models} models · ${stats.sources?.ok ?? stats.sources?.total ?? "?"} / ${sources} sources · ${lastVerified}`);
