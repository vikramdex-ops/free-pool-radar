/**
 * Verifies the *deployed* public surface, not the local build.
 *
 * The failure this catches: a route that returns 200 with an empty array, or a
 * feed that stopped being generated. Runs without secrets on a schedule.
 *
 * Usage: RADAR_BASE_URL=https://fork.example node scripts/verify-data.mjs
 */
const BASE = (process.env.RADAR_BASE_URL ?? "https://free-pool-radar.vercel.app").replace(/\/+$/, "");

let failures = 0;
const ok = (name) => console.log(`ok   ${name}`);
const bad = (name, detail) => {
  failures++;
  console.error(`FAIL ${name} — ${detail}`);
};

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "*/*" }, redirect: "follow" });
  return res;
}

const jsonRoutes = ["/api/live", "/api/providers", "/api/models", "/api/events", "/api/changes", "/api/stats", "/api/dataset"];
for (const path of jsonRoutes) {
  try {
    const res = await get(path);
    if (res.status !== 200) {
      bad(path, `HTTP ${res.status}`);
      continue;
    }
    const body = await res.json();
    if (path.endsWith("/api/stats")) {
      if (typeof body?.data?.freeRoutes !== "number") bad(path, "no numeric data.freeRoutes");
      else ok(path);
      continue;
    }
    if (path.endsWith("/api/dataset")) {
      if (!body?.counts) bad(path, "no counts");
      else ok(path);
      continue;
    }
    if (!Array.isArray(body?.data)) {
      // /api/changes and others are arrays under data; upcoming nests.
      if (body?.data && typeof body.data === "object") ok(path);
      else bad(path, "data is not an array");
      continue;
    }
    ok(path);
  } catch (err) {
    bad(path, String(err));
  }
}

// The feed is XML, not JSON.
try {
  const res = await get("/feed.xml");
  const text = await res.text();
  if (res.status === 200 && text.includes("<feed")) ok("/feed.xml");
  else bad("/feed.xml", `HTTP ${res.status}`);
} catch (err) {
  bad("/feed.xml", String(err));
}

if (failures > 0) {
  console.error(`\n${failures} deployed check(s) failed`);
  process.exit(1);
}
console.log("\nDeployed surface verified.");
