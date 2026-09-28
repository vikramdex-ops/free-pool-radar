/* Reports which elements actually exceed the viewport, so an overflow fix
   targets the cause rather than the symptom. */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3100";
const PAGES = (process.env.PAGES ?? "/,/providers/apmix,/compare").split(",");
const WIDTH = Number(process.env.W ?? 1440);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });

for (const p of PAGES) {
  await page.goto(BASE + p, { waitUntil: "load", timeout: 60000 });
  const out = await page.evaluate((vw) => {
    // An element inside a scroll container is clipped by it, so its wide box is
    // not a document overflow. Only report elements with no clipping ancestor,
    // otherwise a correctly scrollable table looks like a bug.
    const isClipped = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden") return true;
      }
      return false;
    };

    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      if (isClipped(el)) continue;
      bad.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 48)) || "",
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        overflowX: getComputedStyle(el).overflowX,
        minWidth: getComputedStyle(el).minWidth,
      });
    }
    return bad.slice(0, 12);
  }, WIDTH);
  console.log(`\n=== ${p} @ ${WIDTH}px ===`);
  for (const b of out) {
    console.log(
      `  ${b.tag}.${b.cls} left=${b.left} right=${b.right} w=${b.width} overflowX=${b.overflowX} minW=${b.minWidth}`,
    );
  }
}

await browser.close();
