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

      // PRI-001: the primary nav is a scrollable strip with its scrollbar
      // hidden, so the scroll cue and keyboard operability must be asserted
      // directly — the overflow check above cannot see inside the strip.
      // Once per viewport is enough; the nav is identical on every page.
      if (p.name === "home") {
        const nav = await page.evaluate(() => {
          const list = document.querySelector("ul.nav-list");
          if (!list) return { missing: true };
          const style = getComputedStyle(list);
          const cue = getComputedStyle(
            list.parentElement,
            "::after",
          );
          const links = [...list.querySelectorAll("a")].map((a) =>
            a.getAttribute("href"),
          );
          return {
            missing: false,
            tabIndex: list.tabIndex,
            role: list.getAttribute("role"),
            label: list.getAttribute("aria-label"),
            clipped: list.scrollWidth > list.clientWidth + 1,
            cueShown:
              cue.display !== "none" &&
              parseFloat(cue.width) > 0 &&
              cue.content !== "none",
            linkCount: links.length,
            links,
          };
        });
        if (nav.missing) {
          problems.push(`${vp.name}/${theme} nav list missing`);
        } else {
          if (nav.tabIndex !== 0) {
            problems.push(
              `${vp.name}/${theme} nav list not keyboard-focusable (tabIndex ${nav.tabIndex})`,
            );
          }
          if (nav.role !== "region" || !nav.label) {
            problems.push(
              `${vp.name}/${theme} nav scroll region unnamed (role ${nav.role})`,
            );
          }
          if (nav.linkCount !== 8) {
            problems.push(
              `${vp.name}/${theme} nav has ${nav.linkCount} destinations, expected 8`,
            );
          }
          if (nav.clipped && !nav.cueShown) {
            problems.push(
              `${vp.name}/${theme} nav clips destinations with no scroll cue`,
            );
          }
          if (nav.clipped) {
            // Keyboard reachability, with real key presses rather than a
            // programmatic scrollTo: focus the strip and walk it to the far
            // edge with ArrowRight (End scrolls vertically, not along the
            // strip), then confirm the last destination is fully revealed.
            await page.locator("ul.nav-list").focus();
            const keyed = await page.evaluate(() => {
              const list = document.querySelector("ul.nav-list");
              return {
                focused:
                  document.activeElement === list ||
                  list.contains(document.activeElement),
              };
            });
            for (let i = 0; i < 30; i++) {
              // No early break on a stalled reading: a missed frame must
              // cost one press, never the whole walk.
              await page.keyboard.press("ArrowRight");
              await page.waitForTimeout(30);
            }
            const keyedAfter = await page.evaluate(() => {
              const list = document.querySelector("ul.nav-list");
              const links = [...list.querySelectorAll("a")];
              const last = links[links.length - 1].getBoundingClientRect();
              const box = list.getBoundingClientRect();
              return {
                scrolled: list.scrollLeft > 0,
                lastVisible: last.right <= box.right + 1,
              };
            });
            await page.keyboard.press("Home");
            if (!keyed.focused) {
              problems.push(`${vp.name}/${theme} nav strip cannot take focus`);
            }
            if (!keyedAfter.scrolled || !keyedAfter.lastVisible) {
              problems.push(
                `${vp.name}/${theme} last nav destinations unreachable by keyboard scroll`,
              );
            }
          }
        }
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
