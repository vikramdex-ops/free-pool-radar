import { chromium } from "playwright";

/**
 * Verifies the internal auth flow and the search term layer.
 *
 * Both are things that pass a type check and still fail in a browser: a cookie
 * the middleware does not read, a redirect loop, or a term table that matches
 * nothing.
 */

const BASE = process.env.BASE ?? "http://localhost:3133";
const PASSWORD = process.env.ADMIN_PASSWORD;
const WRONG = "definitely-not-the-password";

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();

const errs = [];
p.on("pageerror", (e) => errs.push(String(e.message)));

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

console.log("\n--- auth (A80) ---");

// 1. /admin must not render without a session.
await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
check("/admin redirects when signed out", p.url().includes("/admin/login"), p.url());

// 2. A wrong password must be refused, and must say so without leaking whether
//    the deployment is configured.
await p.fill("#password", WRONG);
await p.click('button[type="submit"]');
// Wait for the specific outcome rather than the network to go quiet. A server
// action redirect does not settle on networkidle, so asserting the URL straight
// after the click reads the pre-redirect page and reports a false failure.
await p.waitForURL(/\/admin\/login\?error=/, { timeout: 15000 });
const err = await p.$(".form-error");
check("wrong password is refused", Boolean(err), err ? (await err.textContent())?.trim() : "no error shown");
check(
  "still on the login page after a wrong password",
  p.url().includes("/admin/login"),
  p.url(),
);

// 3. The real password must sign in and land on the protected page.
await p.fill("#password", PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
// Counted rather than waited for visible. A table inside a horizontally
// scrollable wrapper can be present and laid out while Playwright still judges
// it not visible, which would make this assert on rendering rather than on
// access control — and access control is what this file is for.
await p
  .waitForFunction(() => document.querySelectorAll("table").length > 0, null, { timeout: 15000 })
  .catch(() => {});
check("correct password signs in", !p.url().includes("/login"), p.url());
check(
  "admin renders the source table after sign-in",
  (await p.$$("table")).length > 0,
  `${(await p.$$("table")).length} table(s)`,
);
check(
  "admin does not claim an empty registry",
  !(await p.evaluate(() => document.body.innerText.includes("No sources registered"))),
);
// 4. The session must carry to /discovery.
await p.goto(`${BASE}/discovery`, { waitUntil: "networkidle" });
check("/discovery is reachable once signed in", p.url().endsWith("/discovery"), p.url());
const cands = (await p.$$(".cand")).length;
check("discovery queue lists candidates", cands > 0, `${cands} candidates`);

// 5. Every one of A52's four actions must be present on a candidate.
const actions = await p.$$eval(".cand:first-of-type .cand-buttons button", (els) =>
  els.map((e) => e.getAttribute("value")),
);
check(
  "A52 offers verify / reject / investigate / merge",
  ["verified", "rejected", "investigating", "merged"].every((a) => actions.includes(a)),
  actions.join(", "),
);

// 6. Signing out must close the routes again.
await p.click(".admin-bar button[type=submit]");
await p.waitForURL(/\/admin\/login/, { timeout: 15000 });
check("sign out returns to login", p.url().includes("/admin/login"), p.url());
await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
check("/admin is closed again after sign-out", p.url().includes("/admin/login"), p.url());

console.log("\n--- search (A30) ---");

// Wait on the DOM, not on networkidle. The search page fetches five queries
// server-side, and on a cold cache networkidle can exceed the default timeout
// even though the page is already rendered and usable.
const go = async (url) => {
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(300);
};

// The spec's own examples, including the two that are questions rather than
// text and would return nothing to a literal substring match.
for (const q of ["claude", "no card", "keyless", "Qwen", "shared"]) {
  await go(`${BASE}/search?q=${encodeURIComponent(q)}`);
  const n = (await p.$$(".result")).length;
  const terms = await p.$$eval(".search-terms .chip", (e) => e.map((x) => x.textContent.trim()));
  check(`"${q}" returns results`, n > 0, `${n} results, read as: ${terms.join(" + ") || "(free text)"}`);
}

// A nonsense query must return nothing rather than everything.
await go(`${BASE}/search?q=zzzzznotathing`);
check("a nonsense query returns nothing", (await p.$$(".result")).length === 0);

console.log("\n--- events index ---");
await go(`${BASE}/events`);
const sections = await p.$$eval(".event-row", (e) => e.length);
check("events page lists events", sections > 0, `${sections} events`);
const jump = await p.$$eval(".event-jump a", (e) => e.map((x) => x.textContent.trim()));
check("events page separates running / upcoming / finished", jump.length === 3, jump.join(" | "));

console.log("\n--- filters and sort (A31, A32) ---");
await go(`${BASE}/live`);
const selects = await p.$$eval(".filters select", (e) => e.map((x) => x.id));
check(
  "A31 filter set is present",
  ["f-status", "f-provider", "f-model", "f-access", "f-fresh", "f-quota", "f-sort"].every((id) =>
    selects.includes(id),
  ),
  selects.join(", "),
);

const sortOptions = await p.$$eval("#f-sort option", (e) => e.map((x) => x.textContent.trim()));
check("A32 offers all seven orders", sortOptions.length === 7, sortOptions.join(" | "));
check(
  "no sort order is labelled as a ranking",
  !sortOptions.some((s) => /best|top|worst|rank/i.test(s)),
);

// A status filter must actually narrow the set.
const before = (await p.$$("table.tbl-live tbody tr")).length;
await p.selectOption("#f-provider", { index: 1 });
await p.waitForTimeout(400);
const after = (await p.$$("table.tbl-live tbody tr")).length;
check("a provider filter narrows the set", after < before && after > 0, `${before} → ${after}`);

// The freshness bands must be disjoint and must not exceed the whole set.
//
// Note what is deliberately NOT asserted: that both bands are non-empty. Every
// offer can legitimately be freshly verified after a sweep, in which case the
// "stale" band is empty and that is correct behaviour, not a broken filter.
await p.selectOption("#f-provider", "");
await p.selectOption("#f-fresh", "fresh");
await p.waitForTimeout(400);
const fresh = (await p.$$("table.tbl-live tbody tr")).length;
await p.selectOption("#f-fresh", "aging");
await p.waitForTimeout(400);
const aging = (await p.$$("table.tbl-live tbody tr")).length;
await p.selectOption("#f-fresh", "stale");
await p.waitForTimeout(400);
const stale = (await p.$$("table.tbl-live tbody tr")).length;
check(
  "freshness bands are disjoint and within the set",
  fresh + aging + stale <= before,
  `fresh ${fresh}, aging ${aging}, stale ${stale}, of ${before}`,
);
check(
  "a narrower freshness band never returns more",
  aging <= fresh && stale <= aging + fresh,
);

// Sorting by largest pool must order by pool size descending with missing pools
// last.
//
// This is checked against the data rather than by pattern-matching the rendered
// column. The column shows "35,080,000 USD", "10 rpm · 500,000 tokens" and
// "Not publicly stated" — three shapes, none of which reliably identifies a
// pooled row by eye, so a regex here would test the formatter instead of the
// sort.
await p.selectOption("#f-fresh", "any");
await p.selectOption("#f-sort", "largest_pool");
await p.waitForTimeout(600);

const live = await p.evaluate(async () => {
  const r = await fetch("/api/live");
  const j = await r.json();
  return j.data.map((o) => ({
    label: o.model,
    // The API nests the pool; size is a number or null.
    pool: o.pool && typeof o.pool.size === "number" ? o.pool.size : null,
  }));
});

const expected = live
  .map((o, i) => ({ label: o.label, pool: o.pool, i }))
  // Same rule the component uses: nulls last, then descending pool size.
  .sort((a, b) => {
    if (a.pool === null) return b.pool === null ? a.i - b.i : 1;
    if (b.pool === null) return -1;
    return b.pool - a.pool;
  })
  .map((o) => o.label);

const shown = await p.$$eval("table.tbl-live tbody tr", (rs) =>
  rs.map((r) => (r.children[1]?.textContent ?? "").trim()),
);

const firstMismatch = expected.findIndex((e, i) => shown[i] !== e);
check(
  "largest pool sorts by pool size descending, missing pools last",
  firstMismatch === -1,
  firstMismatch === -1
    ? `${shown.length} rows in the expected order`
    : `row ${firstMismatch}: page "${shown[firstMismatch]}" vs expected "${expected[firstMismatch]}"`,
);

// And the specific hazard: a row with no pool must not outrank one that has
// the largest pool.
const noPool = live.filter((o) => o.pool === null).map((o) => o.label);
const maxPool = Math.max(...live.map((o) => o.pool ?? 0));
const biggest = live.filter((o) => o.pool === maxPool).map((o) => o.label);
const firstNoPool = shown.findIndex((l) => noPool.includes(l));
check(
  "a route with no pool never outranks the largest pool",
  firstNoPool === -1 || biggest.every((l) => shown.indexOf(l) < firstNoPool),
  `largest pool is ${maxPool.toLocaleString("en-GB")}; first no-pool row at ${firstNoPool}`,
);

console.log(`\n${pass} passed, ${fail} failed`);
if (errs.length) console.log("page errors:", errs.slice(0, 3));

await b.close();
process.exit(fail > 0 ? 1 : 0);
