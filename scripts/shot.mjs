/* Viewport-scale capture of a region, for judging composition rather than
   scrolling a full-page screenshot of a very long page. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const path = process.env.PATHNAME ?? "/";
const theme = process.env.THEME ?? "dark";
const width = Number(process.env.W ?? 1440);
const height = Number(process.env.H ?? 900);
const out = process.env.OUT ?? "shot";
const scrollY = Number(process.env.SCROLL ?? 0);

mkdirSync(".review", { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width, height },
  colorScheme: theme,
});
await ctx.addInitScript((t) => localStorage.setItem("fpr-theme", t), theme);
const p = await ctx.newPage();
await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
if (scrollY) {
  await p.evaluate((y) => window.scrollTo(0, y), scrollY);
  await p.waitForTimeout(500);
}
await p.screenshot({ path: `.review/${out}.png` });
console.log(`.review/${out}.png`);
await b.close();
