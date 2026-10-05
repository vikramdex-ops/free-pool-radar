/**
 * Verifies the internal routes against a real deployment.
 *
 * This is the check that would have caught the prerender bug: the local build
 * passed while the served page carried build-time text, so the only trustworthy
 * test is the deployed one with real credentials.
 *
 * SCOPE, ARC-048. This file is the LIVENESS half only: can the served admin
 * page read live data? Those assertions cannot be made statically, because a
 * static check cannot tell you what a deployed page rendered.
 *
 * The SECURITY half - whether the gate itself holds - lives in
 * scripts/test-admin-gate.mjs and runs offline on every commit. That split
 * exists because this file has never been executed by any CI job: playwright
 * is not a dependency and no runner holds the credentials.
 *
 * NOT WIRED INTO ci.yml, deliberately. Run it locally against a deployment:
 *   set ADMIN_PASSWORD=... && node scripts/test-prod-auth.mjs
 *
 * playwright is imported DYNAMICALLY below rather than at the top of the file.
 * A static import is hoisted and resolved before any statement runs, so with a
 * top-level import the preflight below never executes and a missing playwright
 * surfaces as a raw ERR_MODULE_NOT_FOUND stack instead of the instruction.
 */
const BASE = process.env.BASE ?? "https://free-pool-radar.vercel.app";

// ARC-048: the previous fallback read process.env.TEMP + "\\radar-admin-pw.txt",
// an undeclared dependency on a file in the operator's temp directory that no
// runner has and package.json never mentions. Fail loudly and say what is
// needed instead of reaching for a path nothing documents.
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error(
    "ADMIN_PASSWORD is not set.\n" +
      "This test signs in to a real deployment. Set it and re-run:\n" +
      "  set ADMIN_PASSWORD=... && node scripts/test-prod-auth.mjs\n" +
      "The gate logic itself needs no credentials - see scripts/test-admin-gate.mjs.",
  );
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "playwright is not installed.\n" +
      "It is deliberately NOT a dependency of this project, which is why this file\n" +
      "is not wired into ci.yml. To run it:\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "The gate logic needs none of this - see scripts/test-admin-gate.mjs, which\n" +
      "runs offline on every commit with no browser and no new dependency.",
  );
  process.exit(2);
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
let pass = 0, fail = 0;
const check = (n, ok, d = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${d ? ` — ${d}` : ""}`);
};

await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
check("/admin is gated in production", p.url().includes("/admin/login"), p.url());

await p.fill("#password", "wrong-password-entirely");
await p.click('button[type="submit"]');
await p.waitForURL(/\?error=/, { timeout: 20000 });
check("a wrong password is refused in production", (await p.$$(".form-error")).length === 1);

await p.fill("#password", PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
await p.waitForFunction(() => document.querySelectorAll("table").length > 0, null, { timeout: 20000 }).catch(() => {});
const adminTxt = await p.evaluate(() => document.body.innerText);
check("admin renders the live source registry", (await p.$$("table")).length > 0, `${(await p.$$("table")).length} table(s)`);
check("admin is not a build-time snapshot claiming no credential", !adminTxt.includes("No server-side database credential"));
check("admin does not claim an empty registry", !adminTxt.includes("No sources registered"));
const rows = (await p.$$("table tbody tr")).length;
check("the registry lists the real sources", rows >= 10, `${rows} source rows`);

// The value that matters most: does the production page read live data?
//
// ARC-048: this used to assert /29 SEP|30 SEP/, a hard-coded month. The last
// sweep is now 5 October, so the assertion could only fail - a test that has
// never run rotted into a certain failure rather than a possible one, and
// nobody knew because nobody ran it. Re-keyed against a stored value instead:
// the sweep timestamp the public API reports. Two instruments, both live, and
// no literal that can drift.
const stampOf = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${months[d.getUTCMonth()]}`;
};
let reportedSweep = null;
try {
  const res = await fetch(`${BASE}/api/live`, { cache: "no-store" });
  const json = await res.json();
  reportedSweep = json.lastSweepAt ?? null;
} catch (err) {
  reportedSweep = null;
  check("the public API reports a sweep timestamp", false, String(err).slice(0, 80));
}
if (reportedSweep) {
  const stamp = stampOf(reportedSweep);
  check(
    "admin shows the sweep the public API reports",
    adminTxt.includes(stamp),
    `API says ${reportedSweep} (${stamp}); admin page does not contain "${stamp}"`,
  );
} else {
  check("the public API reports a sweep timestamp", false, "no lastSweepAt on /api/live");
}

// And it must not be a frozen build-time snapshot: a page rendered at build
// time carries a stamp from whenever the build ran, which by now is stale.
const ageMs = reportedSweep ? Date.now() - new Date(reportedSweep).getTime() : null;
check(
  "the reported sweep is recent, not a build-time snapshot",
  ageMs !== null && ageMs >= -5 * 60 * 1000 && ageMs < 36 * 60 * 60 * 1000,
  ageMs === null ? "no timestamp" : `${Math.round(ageMs / 60000)} minutes old`,
);

await p.goto(`${BASE}/discovery`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
const cands = (await p.$$(".cand")).length;
check("discovery queue reads live data in production", cands > 0, `${cands} candidates`);

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail > 0 ? 1 : 0);
