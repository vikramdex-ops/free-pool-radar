// CIP-003: prove the Report-Only CSP raises zero unexpected violations.
// Starts no server; set BASE (default http://localhost:3112).
//
// Known inventory (measured, documented — not ignored):
// - dev server: React dev eval + Turbopack inline bootstraps violate.
//   Dev-only; the enforcing policy must still carry 'unsafe-eval' nowhere
//   near production.
// - production: exactly one inline-script violation per page from App Router
//   flight-data scripts (self.__next_f.push), whose content varies per
//   request and cannot be hashed. Enforcement needs nonce-via-proxy (which
//   forces all pages dynamic); until Stark decides that trade-off, this
//   check FAILS by design and is the gate that must pass before flipping
//   to enforcing. style-src, font-src, img-src, connect-src are clean.
// Fails on any console message matching /content security policy/i.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3112";
const PATHS = [
  "/",
  "/live",
  "/providers",
  "/providers/apmix",
  "/models",
  "/compare",
  "/timeline",
  "/search",
  "/methodology",
  "/events",
];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
const violations = [];
const other = [];
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (/content security policy/i.test(m.text())) {
      violations.push(`${vp.name} ${page.url()}: ${m.text().slice(0, 200)}`);
    } else if (m.type() === "error") {
      other.push(`${vp.name}: ${m.text().slice(0, 120)}`);
    }
  });
  page.on("pageerror", (e) => other.push(`${vp.name} pageerror: ${e.message}`));
  for (const p of PATHS) {
    // domcontentloaded + settle: some pages keep connections open, so
    // networkidle never fires; CSP reports on parse/execute, not on idle.
    const res = await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    if (!res || res.status() >= 400) {
      violations.push(`${vp.name} ${p} -> HTTP ${res?.status()}`);
    }
    const headers = res.headers();
    if (!headers["content-security-policy-report-only"]) {
      violations.push(`${vp.name} ${p} missing CSP Report-Only header`);
    }
    if (!headers["permissions-policy"]) {
      violations.push(`${vp.name} ${p} missing Permissions-Policy header`);
    }
  }
  await ctx.close();
}
await browser.close();

if (violations.length) {
  console.log("CSP VIOLATIONS");
  for (const v of [...new Set(violations)]) console.log("  - " + v);
  process.exit(1);
}
console.log("csp-console: ok (Report-Only headers present, zero violations)");
if (other.length) {
  console.log(`(non-CSP console noise, ignored: ${[...new Set(other)].length} kinds)`);
}
