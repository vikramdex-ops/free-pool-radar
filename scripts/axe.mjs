/**
 * axe accessibility audit for the pages a reader lands on.
 *
 * Runs axe-core in a real browser against the served site and reports every
 * violation with its impact. Contrast is checked in both themes, because a
 * palette that passes on dark can fail on light and the site ships both.
 *
 * Usage:
 *   BASE=http://localhost:3110 node scripts/axe.mjs
 *
 * Env:
 *   AXE_PATHS   space-separated paths to audit (default: the landing page)
 */
import { chromium } from "playwright";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.env.BASE ?? "http://localhost:3110";
const PATHS = (process.env.AXE_PATHS ?? "/ /live /developers").split(/\s+/).filter(Boolean);
const THEMES = ["dark", "light"];

const browser = await chromium.launch();
let total = 0;
let rows = 0;

for (const theme of THEMES) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: theme,
    reducedMotion: "reduce",
  });
  await ctx.addInitScript((t) => localStorage.setItem("fpr-theme", t), theme);
  const page = await ctx.newPage();

  for (const path of PATHS) {
    const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
    if (!res || res.status() >= 400) {
      console.log(`SKIP ${path} -> ${res?.status()}`);
      continue;
    }
    await page.addScriptTag({ path: AXE });
    const result = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      return await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      });
    });
    rows++;
    if (result.violations.length === 0) {
      console.log(`ok   ${path} (${theme})`);
      continue;
    }
    for (const v of result.violations) {
      total++;
      console.log(`FAIL ${path} (${theme}) [${v.impact}] ${v.id}: ${v.help}`);
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`       ${n.target.join(" ")}`);
      }
    }
  }
  await ctx.close();
}

await browser.close();

if (total > 0) {
  console.log(`\n${total} axe violation(s) across ${rows} page renders`);
  process.exit(1);
}
console.log(`\naxe green: ${rows} page renders, both themes`);
