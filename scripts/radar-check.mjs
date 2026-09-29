import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3133";
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 950 },
  colorScheme: process.env.THEME ?? "dark",
});
await ctx.addInitScript(
  (t) => localStorage.setItem("fpr-theme", t),
  process.env.THEME ?? "dark",
);
const p = await ctx.newPage();
await p.goto(BASE + "/", { waitUntil: "networkidle" });

const svg = await p.$(".radar-svg");
const box = await svg.boundingBox();

// Hover a contact. The hit areas are deliberately larger than the dots, so
// this targets what a reader's cursor would actually land on.
const hits = await p.$$(".radar-hit");
console.log(`contacts with a hit area: ${hits.length}`);

let hovered = null;
for (const h of hits) {
  const hb = await h.boundingBox();
  if (!hb) continue;
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await p.waitForTimeout(320);
  const readout = await p.$(".radar-readout");
  if (readout) {
    hovered = (await readout.textContent())?.replace(/\s+/g, " ").trim();
    break;
  }
}
console.log(`hover readout: ${hovered ?? "none"}`);

// Pointer lean: the sweep group should carry a rotation once the pointer moves.
await p.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 8 });
await p.waitForTimeout(400);
const lean = await p.$eval(".radar-lean", (el) => el.style.transform);
console.log(`sweep lean transform: ${lean}`);

const arcs = await p.$$eval(".radar-arc", (els) =>
  els.map((e) => ({
    len: Math.round(e.getTotalLength()),
    stroke: getComputedStyle(e).strokeWidth,
  })),
);
console.log(`upcoming arcs on the rim: ${arcs.length}`, JSON.stringify(arcs));

await p.screenshot({ path: ".review/radar-hover.png", clip: {
  x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 90,
} });
console.log(".review/radar-hover.png");
await b.close();
