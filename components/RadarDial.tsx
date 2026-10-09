"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The radar (§18, §71).
 *
 * Every mark on this instrument is a row in the database. The mapping is
 * fixed, so the picture cannot drift from the data:
 *
 *   ring      pool scale, outermost for the largest pool
 *   contact   one provider, placed by a golden-angle spiral
 *   height    how recently it was verified — fresh contacts stand higher
 *   arc       an upcoming event, sitting on the rim
 *   glow      a provider that changed on the most recent sweep
 *
 * The plane is tilted about its horizontal axis, so a circle of radius rr in
 * the plane is an ellipse of (rr, rr·sin TILT) on screen. Contacts are then
 * raised OUT of the plane by a lift proportional to their own radius, and each
 * one drops a hairline back down to the plane it came from. That hairline is
 * the whole illusion: without it the lift reads as drift, and the dial looks
 * like dots scattered on glass.
 *
 * The tilt and the lift are uniform, so two contacts keep their relative size
 * and height on every frame. Depth here is a reading of the data, not a
 * perspective trick laid over it.
 *
 * Motion is one sweep and a handful of pulses. Nothing is scroll-triggered,
 * nothing counts up, and all of it stops for prefers-reduced-motion, where the
 * instrument is drawn once, in its final state, and left alone.
 */

export interface RadarProvider {
  slug: string;
  name: string;
  /** Radius fraction, 0–1. Pool scale decides this where a pool exists. */
  r: number;
  /** Angle in radians around the plane. */
  angle: number;
  status: "live" | "upcoming" | "other";
  /** 0–1, for opacity. Recency decides this. */
  fresh: number;
  pool: string | null;
  pulse: boolean;
}

export interface RadarArc {
  slug: string;
  label: string;
  /** 0–1 around the rim, where the arc starts. */
  start: number;
  /** 0–1, how wide the arc is. */
  span: number;
  daysOut: number;
}

const SIZE = 560;
/** sin of the viewing elevation. Straight-on would be 1; this looks down. */
const SQUASH = Math.sin(0.62);
const R_MAX = 236;
/** Lift out of the plane per unit radius, in px at the base size. */
const LIFT = 58;
const TAU = Math.PI * 2;

interface Placed {
  p: RadarProvider;
  /** The raised, drawn position. */
  x: number;
  y: number;
  /** The point on the plane directly beneath it, for the anchor hairline. */
  baseY: number;
  radius: number;
}

export function Radar({
  providers,
  arcs,
  largestPool,
}: {
  providers: RadarProvider[];
  arcs: RadarArc[];
  /** The biggest published pool, already formatted in its own unit. */
  largestPool: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const placedRef = useRef<Placed[]>([]);
  const frameRef = useRef(0);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(m.matches);
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, []);

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      // Re-read the palette every frame, so a theme flip needs no rebuild.
      const css = readColors();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      const px = box.width || SIZE;
      const py = box.height || SIZE;
      const targetW = Math.round(px * dpr);
      if (canvas.width !== targetW) {
        canvas.width = targetW;
        canvas.height = Math.round(py * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, px, py);

      const s = px / SIZE;
      const cx = px / 2;
      const cy = py / 2 + LIFT * s * 0.4;
      const R = R_MAX * s;
      /** Plane coordinate → screen. The tilt only; no lift. */
      const project = (a: number, rr: number) => ({
        x: cx + Math.cos(a) * rr,
        y: cy + Math.sin(a) * rr * SQUASH,
      });

      drawField(ctx, cx, cy, R, css);
      drawGrid(ctx, cx, cy, project, R, css);
      drawArcs(ctx, project, R, s, css, arcs);
      drawSweep(ctx, cx, cy, R, s, css, time, reduced);

      // Depth-sort so nearer contacts paint last and stay on top.
      const placed: Placed[] = providers.map((p) => {
        const onPlane = project(p.angle, p.r * R);
        // Lift rises with radius, so the outer contacts sit highest — the same
        // ordering the rings already declare.
        const lift = p.r * LIFT * s;
        return {
          p,
          x: onPlane.x,
          y: onPlane.y - lift,
          baseY: onPlane.y,
          radius: (2.4 + 2.6 * p.fresh) * s,
        };
      });
      placed.sort((a, b) => b.baseY - a.baseY);
      placedRef.current = placed;

      drawContacts(ctx, placed, css, time, s, reduced);
    },
    [providers, arcs, reduced],
  );

  useEffect(() => {
    if (reduced) {
      // One static frame, in its final state.
      draw(0);
      const obs = new MutationObserver(() => draw(0));
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => obs.disconnect();
    }
    const loop = (t: number) => {
      draw(t);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw, reduced]);

  const hitTest = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: Placed | null = null;
    let bestD = 22;
    for (const c of placedRef.current) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    setHovered(best ? best.p.slug : null);
  }, []);

  const active = providers.find((p) => p.slug === hovered) ?? null;

  return (
    <div className="radar">
      <div className="radar-stage">
        <canvas
          ref={canvasRef}
          className="radar-canvas"
          role="img"
          aria-label={`Radar showing ${providers.length} providers with free access${
            arcs.length
              ? `, and ${arcs.length} upcoming event${arcs.length === 1 ? "" : "s"}`
              : ""
          }.`}
          onPointerMove={hitTest}
          onPointerLeave={() => setHovered(null)}
        />
        <div className="radar-vignette" aria-hidden="true" />

        {/* The readout follows the pointer's subject rather than sitting in a
            fixed corner, so the eye does not have to travel. */}
        {active ? (
          <div className="radar-readout" role="status">
            <p className="radar-readout-name">{active.name}</p>
            <p className="radar-readout-meta">
              {active.pool ? active.pool : `${active.status} free access`}
            </p>
            <Link href={`/providers/${active.slug}`} className="link-ev">
              Open provider <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : null}
      </div>

      <RadarLegend
        contactCount={providers.length}
        arcs={arcs}
        largestPool={largestPool}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* canvas painting                                                     */
/* ------------------------------------------------------------------ */

/** The palette is CSS-owned, so the instrument follows the theme. */
function readColors() {
  if (typeof window === "undefined") {
    return {
      rule: "#1c2634",
      rule2: "#131b26",
      live: "#3ddc84",
      upcoming: "#f2b134",
      stale: "#8595aa",
    };
  }
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    rule: get("--t-rule", "#1c2634"),
    rule2: get("--t-rule-2", "#131b26"),
    live: get("--t-live", "#3ddc84"),
    upcoming: get("--t-upcoming", "#f2b134"),
    stale: get("--t-stale", "#8595aa"),
  };
}

type Colors = ReturnType<typeof readColors>;
type Project = (a: number, r: number) => { x: number; y: number };

/** The glow under the plane: faint, and only where the field is. */
function drawField(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  css: Colors,
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.15);
  g.addColorStop(0, hexA(css.live, 0.1));
  g.addColorStop(0.55, hexA(css.live, 0.03));
  g.addColorStop(1, hexA(css.live, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 1.02, R * SQUASH * 1.02, 0, 0, TAU);
  ctx.fill();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  project: Project,
  R: number,
  css: Colors,
) {
  // Range rings: the pool scale. The outer one is solid, the rest dashed.
  // A ring is centred on the plane's own centre — the tilt squashes it, it
  // does not move it.
  ctx.strokeStyle = css.rule;
  ctx.lineWidth = 1;
  for (const f of [0.34, 0.56, 0.78, 1]) {
    ctx.setLineDash(f === 1 ? [] : [2, 7]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * f, R * f * SQUASH, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Bearing spokes, from the plane's centre out to the rim.
  ctx.strokeStyle = css.rule2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const rim = project((i / 12) * TAU, R);
    ctx.moveTo(cx, cy);
    ctx.lineTo(rim.x, rim.y);
  }
  ctx.stroke();
}

function drawArcs(
  ctx: CanvasRenderingContext2D,
  project: Project,
  R: number,
  s: number,
  css: Colors,
  arcs: RadarArc[],
) {
  if (arcs.length === 0) return;
  ctx.strokeStyle = hexA(css.upcoming, 0.85);
  ctx.lineWidth = 2 * s;
  ctx.lineCap = "round";
  for (const arc of arcs) {
    const steps = 26;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const frac = arc.start + (arc.span * i) / steps;
      const rim = project(frac * TAU - Math.PI / 2, R);
      i === 0 ? ctx.moveTo(rim.x, rim.y) : ctx.lineTo(rim.x, rim.y);
    }
    ctx.stroke();

    // A tick at its head, so an arc points at a moment in time.
    const head = project(arc.start * TAU - Math.PI / 2, R);
    ctx.fillStyle = hexA(css.upcoming, 0.95);
    ctx.beginPath();
    ctx.arc(head.x, head.y, 2.2 * s, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = "butt";
}

function drawSweep(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  s: number,
  css: Colors,
  time: number,
  reduced: boolean,
) {
  // With motion allowed the sweep is driven by the clock; a reduced reader
  // gets it parked at a bearing of its own, drawn once.
  const deg = reduced ? 300 : (time * 0.055) % 360;
  const a0 = (deg * Math.PI) / 180 - Math.PI / 2;
  const span = Math.PI / 4.2;
  const steps = 44;

  const tipX = cx + Math.cos(a0) * R;
  const tipY = cy + Math.sin(a0) * R * SQUASH;
  const g = ctx.createLinearGradient(cx, cy, tipX, tipY);
  g.addColorStop(0, hexA(css.live, 0));
  g.addColorStop(1, hexA(css.live, 0.28));

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (let i = 0; i <= steps; i++) {
    const a = a0 - span * (i / steps);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * SQUASH);
  }
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // The leading edge.
  ctx.strokeStyle = hexA(css.live, 0.55);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // A travelling blip rides the edge — proof the instrument is still on.
  ctx.fillStyle = hexA(css.live, reduced ? 0.7 : 0.9);
  ctx.beginPath();
  ctx.arc(
    cx + Math.cos(a0) * R * 0.82,
    cy + Math.sin(a0) * R * 0.82 * SQUASH,
    1.7 * s,
    0,
    TAU,
  );
  ctx.fill();
}

function drawContacts(
  ctx: CanvasRenderingContext2D,
  placed: Placed[],
  css: Colors,
  time: number,
  s: number,
  reduced: boolean,
) {
  for (const c of placed) {
    const color =
      c.p.status === "live"
        ? css.live
        : c.p.status === "upcoming"
          ? css.upcoming
          : css.stale;

    // A changed contact gets a slow ring, so "something moved" reads without
    // text. Parked for a reduced reader.
    if (c.p.pulse && !reduced) {
      const t = (time / 1400) % 1;
      ctx.strokeStyle = hexA(color, 0.5 * (1 - t));
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.arc(c.x, c.y, (3 + t * 13) * s, 0, TAU);
      ctx.stroke();
    }

    // The anchor: a hairline from the contact down to the plane, which is what
    // makes the lift read as height rather than as drift.
    ctx.strokeStyle = hexA(color, 0.24);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x, c.baseY);
    ctx.stroke();

    // The halo.
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius * 3);
    glow.addColorStop(0, hexA(color, 0.34 * c.p.fresh));
    glow.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius * 3, 0, TAU);
    ctx.fill();

    // The dot.
    ctx.fillStyle = hexA(color, 0.35 + 0.65 * c.p.fresh);
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, TAU);
    ctx.fill();
  }
}

/** hex → rgba(), tolerant of an empty or malformed token. */
function hexA(hex: string, alpha: number): string {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const h = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* ------------------------------------------------------------------ */

function RadarLegend({
  contactCount,
  arcs,
  largestPool,
}: {
  contactCount: number;
  arcs: RadarArc[];
  largestPool: string | null;
}) {
  return (
    <div className="radar-legend-block">
      {/* One-line key. Without it the dial is decoration: a reader needs to
          know what a dot, an arc and the outer ring encode before the picture
          carries any information. */}
      <p className="annot radar-key">
        <span aria-hidden="true">●</span> one dot per provider,{" "}
        <span aria-hidden="true">◜</span> an arc for each announced pool, and the
        outer ring is drawn to the largest pooled figure.
      </p>
      <dl className="radar-legend">
        <div>
          <dt className="label">Providers plotted</dt>
          <dd className="mono">{contactCount}</dd>
        </div>
        <div>
          <dt className="label">Upcoming arcs</dt>
          <dd className="mono">
            {arcs.length ? (
              <span className="radar-legend-arc" aria-hidden="true" />
            ) : null}
            {arcs.length}
          </dd>
        </div>
        <div>
          {/* The unit is whatever the provider published, not a fixed one: a
              pool denominated in dollars must not be labelled as tokens (§56). */}
          <dt className="label">Outer ring</dt>
          <dd className="mono">{largestPool ?? "No pooled offer"}</dd>
        </div>
      </dl>
    </div>
  );
}
