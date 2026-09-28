/* Verifies the running dev server across viewports and themes.
   Screenshots land in .review/ so they can be inspected. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3111";
const OUT = ".review";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { path: "/", name: "home" },
  { path: "/live", name: "live" },
  { path: "/providers", name: "providers" },
  { path: "/providers/apmix", name: "provider-apmix" },
  { path: "/providers/kilo", name: "provider-kilo" },
  { path: "/models", name: "models" },
  { path: "/compare", name: "compare" },
  { path: "/timeline", name: "timeline" },
  { path: "/methodology", name: "methodology" },
  { path: "/admin", name: "admin" },
  { path: "/events/apmix-community-event", name: "event-apmix" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
const problems = [];

for (const vp of VIEWPORTS) {
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      colorScheme: theme,
    });
    // Set the stored preference before any script runs.
    await ctx.addInitScript(
      (t) => localStorage.setItem("fpr-theme", t),
      theme,
    );
    const page = await ctx.newPage();

    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

    for (const p of PAGES) {
      const res = await page.goto(BASE + p.path, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      if (!res || res.status() >= 400) {
        problems.push(`${vp.name}/${theme} ${p.path} -> ${res?.status()}`);
        continue;
      }

      // Horizontal overflow: the real user-facing test is whether the page can
      // be scrolled sideways, not what documentElement.scrollWidth reports. A
      // wide table inside a scroll container legitimately makes that number
      // larger than the viewport while the page still cannot scroll.
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        window.scrollTo(2000, 0);
        const scrolledX = window.scrollX;
        window.scrollTo(0, 0);

        // Also catch content wider than the viewport that is not inside a
        // deliberate scroll container, which would be a genuine bug.
        const unclipped = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= de.clientWidth + 1) continue;
          let clipper = false;
          for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
            const o = getComputedStyle(n).overflowX;
            if (o === "auto" || o === "scroll" || o === "hidden") {
              clipper = true;
              break;
            }
          }
          if (!clipper) {
            unclipped.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}`,
            );
          }
        }
        return { scrolledX, unclipped: [...new Set(unclipped)].slice(0, 4) };
      });
      if (overflow.scrolledX > 0) {
        problems.push(
          `${vp.name}/${theme} ${p.path} scrolls sideways by ${overflow.scrolledX}px`,
        );
      }
      if (overflow.unclipped.length) {
        problems.push(
          `${vp.name}/${theme} ${p.path} content past viewport: ${overflow.unclipped.join(", ")}`,
        );
      }

      if (p.name === "home" || vp.name === "desktop") {
        await page.screenshot({
          path: `${OUT}/${p.name}-${vp.name}-${theme}.png`,
          fullPage: vp.name === "desktop",
        });
      }
    }

    if (consoleErrors.length) {
      problems.push(
        `${vp.name}/${theme} console: ${[...new Set(consoleErrors)].slice(0, 3).join(" | ")}`,
      );
    }
    await ctx.close();
  }
}

await browser.close();

if (problems.length) {
  console.log("PROBLEMS");
  for (const p of problems) console.log("  - " + p);
} else {
  console.log("OK: no console errors, no overflow, all pages 200");
}
