import { chromium } from "playwright";

// The hero instrument is a canvas now, so there are no per-contact DOM nodes
// to hover: hit-testing lives inside the component. This drives the real
// pointer across the stage and reads the readout that appears when a contact
// is under it, which is the behaviour a reader actually gets.
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

const canvas = await p.$(".radar-canvas");
if (!canvas) {
  console.error("FAIL: no .radar-canvas on the landing page");
  process.exit(1);
}
const box = await canvas.boundingBox();
const label = await canvas.getAttribute("aria-label");
console.log(`canvas stage: ${Math.round(box.width)}x${Math.round(box.height)}`);
console.log(`aria-label: ${label}`);

// The canvas must have real pixels, not just dimensions.
const painted = await canvas.evaluate((el) => {
  const ctx = el.getContext("2d");
  const { data } = ctx.getImageData(0, 0, el.width, el.height);
  let lit = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 8) lit++;
  return lit;
});
console.log(`lit pixels: ${painted}`);
if (painted === 0) {
  console.error("FAIL: the canvas is blank");
  process.exit(1);
}

// Sweep a grid of pointer positions: a reader probes, and the readout should
// appear when a contact lands under the cursor.
let hovered = null;
outer: for (let gy = 0.18; gy < 0.9; gy += 0.06) {
  for (let gx = 0.12; gx < 0.92; gx += 0.05) {
    await p.mouse.move(box.x + box.width * gx, box.y + box.height * gy);
    await p.waitForTimeout(45);
    const readout = await p.$(".radar-readout");
    if (readout) {
      hovered = (await readout.textContent())?.replace(/\s+/g, " ").trim();
      break outer;
    }
  }
}
console.log(`hover readout: ${hovered ?? "none"}`);
if (!hovered) {
  console.error("FAIL: sweeping the pointer found no contact readout");
  process.exit(1);
}

await p.screenshot({
  path: ".review/radar-hover.png",
  clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 90 },
});
console.log(".review/radar-hover.png");
await b.close();
