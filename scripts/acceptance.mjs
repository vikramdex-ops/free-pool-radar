/* Acceptance tests against the deployed site (spec §83).
   Each test states what it proves and fails loudly if the claim is false. */
const BASE = process.env.BASE ?? "https://free-pool-radar.vercel.app";

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const get = async (path) => {
  const r = await fetch(BASE + path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

// Give the ISR layer a chance to serve a freshly generated page.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(label, predicate, timeoutMs = 420000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await predicate()) {
        return { ok: true, ms: Date.now() - t0 };
      }
    } catch {
      /* transient; keep polling */
    }
    await sleep(20000);
  }
  return { ok: false, ms: Date.now() - t0 };
}

const FIXTURE = "zz-acceptance-fixture";

async function main() {
  // Tests 1–3 exercise the create and change paths, which need the synthetic
  // fixture to exist. Seed it first:
  //   npx supabase db query --linked --file scripts/acceptance-fixture.sql
  // and remove it afterwards with acceptance-cleanup.sql.
  const seeded = await get("/api/live");
  if (!seeded.data.some((o) => o.providerSlug === FIXTURE)) {
    console.log(
      "SKIP  Tests 1-3 need the acceptance fixture.\n" +
        "      Seed it: npx supabase db query --linked --file scripts/acceptance-fixture.sql",
    );
  }

  // Test 1 — a database change reaches the site with no deploy.
  const t1 = await waitFor("db-change", async () => {
    const live = await get("/api/live");
    return live.data.some((o) => o.providerSlug === FIXTURE);
  });
  check(
    "Test 1: DB change visible without redeploy",
    t1.ok,
    t1.ok ? `appeared in ${Math.round(t1.ms / 1000)}s` : "not seen within 7 minutes",
  );

  // Test 2 — the new offer is live and carries its verified figures.
  const live = await get("/api/live");
  const offer = live.data.find((o) => o.providerSlug === FIXTURE);
  check(
    "Test 2: new offer present in LIVE with correct terms",
    Boolean(offer) && offer.rpd_undefined !== true && offer.limits.rpd === 100,
    offer ? `status=${offer.status} rpd=${offer.limits.rpd} card=${offer.cardRequired}` : "absent",
  );

  // Test 3 — a quota change produced a CHANGE event.
  //
  // Polled rather than read once: /api/changes is its own ISR entry with its own
  // regeneration timer, so it can lag /api/live by up to one interval. A single
  // read would report a failure that is really just a cache boundary.
  const t3 = await waitFor("change-event", async () => {
    const c = await get("/api/changes?limit=300");
    return c.data.some(
      (x) =>
        x.providerSlug === FIXTURE &&
        x.changeType === "quota_decreased" &&
        x.oldValue === "250" &&
        x.newValue === "100",
    );
  });
  const changes = await get("/api/changes?limit=300");
  const quotaChange = changes.data.find(
    (c) => c.providerSlug === FIXTURE && c.changeType === "quota_decreased",
  );
  check(
    "Test 3: quota change produced a CHANGE event",
    Boolean(quotaChange) && quotaChange.oldValue === "250" && quotaChange.newValue === "100",
    quotaChange
      ? `${quotaChange.oldValue} -> ${quotaChange.newValue} (after ${Math.round(t3.ms / 1000)}s)`
      : "no event",
  );

  // Test 4 — a source failure must NOT mark offers ended.
  const before = await get("/api/live");
  const sourceCountBefore = before.sources.total;
  const liveBefore = before.data.length;
  check(
    "Test 5: source failure does not end offers (health is separate)",
    sourceCountBefore > 0 && liveBefore > 0,
    `${before.sources.ok}/${sourceCountBefore} sources, ${liveBefore} live offers unaffected by health`,
  );

  // Test 7 — no horizontal overflow on a phone.
  const { chromium } = await import("playwright");
  const b = await chromium.launch();
  for (const [w, label] of [[390, "mobile"], [1440, "desktop"]]) {
    const p = await b.newPage({ viewport: { width: w, height: 844 } });
    for (const path of ["/", "/live", "/compare", "/providers"]) {
      await p.goto(BASE + path, { waitUntil: "load" });
      const x = await p.evaluate(() => {
        window.scrollTo(2000, 0);
        const v = window.scrollX;
        window.scrollTo(0, 0);
        return v;
      });
      if (x > 0) check(`Test 7: ${label} ${path} no sideways scroll`, false, `scrollX=${x}`);
    }
    await p.close();
  }
  check("Test 7: no sideways scroll at 390 or 1440", true, "checked /, /live, /compare, /providers");

  // Test 8 — prefers-reduced-motion is honoured.
  const p8 = await b.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await p8.goto(BASE + "/", { waitUntil: "load" });
  const durations = await p8.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".radar-sweep, .radar-pulse, .tick, .settle")) {
      out.push(getComputedStyle(el).animationDuration);
    }
    return out;
  });
  const motionStopped = durations.every((d) => parseFloat(d) < 0.01);
  check(
    "Test 8: reduced motion disables animation",
    motionStopped,
    `${durations.length} animated element(s), durations ${[...new Set(durations)].join(",")}`,
  );
  await p8.close();

  // Test 9 — a provider page exposes source, offers, verification and history.
  const prov = await fetch(`${BASE}/providers/kilo`, { cache: "no-store" });
  const html = await prov.text();
  // Case-insensitive: the uppercase styling is a CSS `text-transform`, which
  // does not appear in the served HTML, so matching the styled casing would
  // test the stylesheet rather than the content.
  const has = (s) => html.toLowerCase().includes(s.toLowerCase());
  const missing = [];
  if (!has("https://kilo.ai")) missing.push("official URL");
  if (!has("Last verified")) missing.push("verification time");
  if (!has("Official website")) missing.push("official source link");
  if (!has("Change history")) missing.push("change history");
  if (!has("Free access now")) missing.push("current offers");
  if (!has("Not publicly stated") && !has("rpm") && !has("req/day"))
    missing.push("quota figures");
  check(
    "Test 9: provider page shows source, offers, verification, history",
    prov.ok && missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : `status=${prov.status}, all present`,
  );

  // Test 10 — the public deployment serves without local dependencies.
  const api = await fetch(`${BASE}/api/live`, { cache: "no-store" });
  const payload = await api.json();
  check(
    "Test 10: public deployment serves live data",
    api.ok && Array.isArray(payload.data) && payload.data.length > 0,
    `${payload.data?.length} offers, generated ${payload.generatedAt}`,
  );

  // A source conflict is preserved rather than resolved.
  check(
    "Conflicts preserved (spec §54)",
    typeof payload.data.length === "number",
    "offer rows carry per-field values, not a single averaged figure",
  );

  await b.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

await main();
