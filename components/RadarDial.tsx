"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The radar (§18, §71).
 *
 * Every mark on this dial is a row in the database. The mapping is fixed:
 *
 *   ring      token pool scale, outermost for the largest pool
 *   point     one provider, placed by a golden-angle spiral
 *   brightness how recently it was verified
 *   arc       an upcoming event, sitting on the rim
 *   pulse     a provider that changed on the most recent sweep
 *
 * Because the mapping is derived from the data, the visualisation cannot drift
 * from it: if the database says there are no pooled offers, the outer rings
 * empty out.
 *
 * Interaction is deliberately restrained. A radar is an instrument, so the
 * pointer moves the sweep, a hovered contact brightens and names itself, and a
 * click goes to that provider. Nothing bounces, nothing chases the cursor, and
 * all of it stops under prefers-reduced-motion (§45).
 */

export interface RadarProvider {
  slug: string;
  name: string;
  /** Radius fraction, 0–1. Pool scale decides this where a pool exists. */
  r: number;
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

const CX = 200;
const CY = 200;
const R_MAX = 168;

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
  const [hovered, setHovered] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // The sweep leans toward the pointer, so the dial feels connected to the
  // hand rather than animating on its own beside it.
  const lean = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    setPointer({
      x: (e.clientX - r.left) / r.width - 0.5,
      y: (e.clientY - r.top) / r.height - 0.5,
    });
  }, []);

  useEffect(() => {
    if (!pointer) return;
    const id = setTimeout(() => setPointer(null), 900);
    return () => clearTimeout(id);
  }, [pointer]);

  const active = providers.find((p) => p.slug === hovered) ?? null;
  const leanDeg = pointer ? (pointer.x * 14 - pointer.y * 10) : 0;

  return (
    <div className="radar">
      <div className="radar-stage">
        <svg
          ref={svgRef}
          viewBox="0 0 400 400"
          className="radar-svg"
          role="img"
          aria-label={`Radar showing ${providers.length} providers with free access${arcs.length ? `, and ${arcs.length} upcoming event${arcs.length === 1 ? "" : "s"}` : ""}.`}
          onPointerMove={lean}
          onPointerLeave={() => setPointer(null)}
        >
          <defs>
            <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--t-live)" stopOpacity="0.09" />
              <stop offset="70%" stopColor="var(--t-live)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="radar-sweep-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--t-live)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--t-live)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect width="400" height="400" fill="url(#radar-glow)" />

          {/* Range rings: the pool scale. */}
          {[0.34, 0.56, 0.78, 1].map((f) => (
            <circle
              key={f}
              cx={CX}
              cy={CY}
              r={R_MAX * f}
              fill="none"
              stroke="var(--t-rule)"
              strokeWidth="1"
              strokeDasharray={f === 1 ? undefined : "2 6"}
            />
          ))}

          {/* Bearing spokes. */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={CX}
                y1={CY}
                x2={CX + Math.cos(a) * R_MAX}
                y2={CY + Math.sin(a) * R_MAX}
                stroke="var(--t-rule-2)"
                strokeWidth="1"
              />
            );
          })}

          {/* The sweep. The wedge is the only continuous motion on the page.

              The pointer lean and the rotation live on separate groups on
              purpose: a CSS animation on `transform` outranks an inline style,
              so a single group would let the spin silently win and the dial
              would never respond to the cursor. */}
          <g
            className="radar-lean"
            style={{ transform: `rotate(${leanDeg}deg)` }}
          >
            <g className="radar-sweep">
              <path
                d={wedge(CX, CY, R_MAX, -Math.PI / 2, -Math.PI / 2 + Math.PI / 5)}
                fill="url(#radar-sweep-grad)"
              />
              <line
                x1={CX}
                y1={CY}
                x2={CX}
                y2={CY - R_MAX}
                stroke="var(--t-live)"
                strokeWidth="1"
                strokeOpacity="0.45"
              />
            </g>
          </g>

          {/* Upcoming events, on the rim.
              A thin, flat arc hugging the outer ring, with a tick at its head.
              Previously this was a thick filled wedge floating inside the dial,
              which read as a stray shape rather than as a scheduled event. */}
          <g className="radar-arcs">
            {arcs.map((a) => {
              const mid = (a.start + a.span / 2) * Math.PI * 2 - Math.PI / 2;
              return (
                <g key={a.slug}>
                  <path
                    d={rimArc(CX, CY, R_MAX - 1, a.start, a.span)}
                    className="radar-arc"
                  />
                  <circle
                    cx={CX + Math.cos(mid) * (R_MAX - 1)}
                    cy={CY + Math.sin(mid) * (R_MAX - 1)}
                    r="2.5"
                    className="radar-arc-head"
                  />
                </g>
              );
            })}
          </g>

          {/* One contact per provider. */}
          {providers.map((p) => {
            const x = CX + Math.cos(p.angle) * p.r * R_MAX;
            const y = CY + Math.sin(p.angle) * p.r * R_MAX;
            const on = hovered === p.slug;
            const color =
              p.status === "live"
                ? "var(--t-live)"
                : p.status === "upcoming"
                  ? "var(--t-upcoming)"
                  : "var(--t-stale)";
            return (
              <g key={p.slug}>
                {p.pulse && !on ? (
                  <circle
                    className="radar-pulse"
                    cx={x}
                    cy={y}
                    r="3"
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                  />
                ) : null}
                {/* A generous invisible hit area: a 3px dot is not a target. */}
                <circle
                  cx={x}
                  cy={y}
                  r="14"
                  fill="transparent"
                  className="radar-hit"
                  onPointerEnter={() => setHovered(p.slug)}
                  onPointerLeave={() => setHovered((h) => (h === p.slug ? null : h))}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={on ? 5 : 3}
                  fill={color}
                  fillOpacity={on ? 1 : p.fresh}
                  className="radar-dot"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                />
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r="2" fill="var(--t-ink-3)" />
        </svg>

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
        <span aria-hidden="true">◜</span> an arc for each announced pool, and
        the outer ring is drawn to the largest pooled figure.
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

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

function wedge(cx: number, cy: number, r: number, from: number, to: number): string {
  const x1 = cx + Math.cos(from) * r;
  const y1 = cy + Math.sin(from) * r;
  const x2 = cx + Math.cos(to) * r;
  const y2 = cy + Math.sin(to) * r;
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/**
 * A thin arc on the outer rim, given as fractions of a full turn.
 *
 * Kept to a fixed visual thickness regardless of radius so an event two days
 * out does not draw a heavier mark than one in twenty.
 */
function rimArc(
  cx: number,
  cy: number,
  r: number,
  startFrac: number,
  spanFrac: number,
): string {
  const from = startFrac * Math.PI * 2 - Math.PI / 2;
  const to = (startFrac + spanFrac) * Math.PI * 2 - Math.PI / 2;
  const x1 = cx + Math.cos(from) * r;
  const y1 = cy + Math.sin(from) * r;
  const x2 = cx + Math.cos(to) * r;
  const y2 = cy + Math.sin(to) * r;
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
