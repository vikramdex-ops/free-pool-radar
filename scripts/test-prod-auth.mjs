import { chromium } from "playwright";
import { readFileSync } from "node:fs";

/**
 * Verifies the internal routes against a real deployment.
 *
 * This is the check that would have caught the prerender bug: the local build
 * passed while the served page carried build-time text, so the only trustworthy
 * test is the deployed one with real credentials.
 */
const BASE = process.env.BASE ?? "https://free-pool-radar.vercel.app";
const PASSWORD =
  process.env.ADMIN_PASSWORD ?? readFileSync(process.env.TEMP + "\\radar-admin-pw.txt", "utf8").trim();

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
check("admin shows a recent sweep", /29 SEP|30 SEP/.test(adminTxt));

await p.goto(`${BASE}/discovery`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
const cands = (await p.$$(".cand")).length;
check("discovery queue reads live data in production", cands > 0, `${cands} candidates`);

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail > 0 ? 1 : 0);
