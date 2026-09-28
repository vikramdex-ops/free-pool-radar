/**
 * The radar (§18, §71).
 *
 * Every mark on this dial is a row in the database. The mapping is fixed:
 *
 *   ring      token pool scale, outermost for the largest pool
 *   point     one provider, placed by a stable hash of its slug
 *   brightness how recently it was verified
 *   arc       an upcoming event, spanning the time until it opens
 *   pulse     a provider that changed on the most recent sweep
 *
 * The point of doing it this way is that the visualisation cannot drift from
 * the data: if the database says there are no free models, there are no
 * points. There is no decorative animation pretending to be a signal.
 *
 * It is server-rendered SVG, so it works with JavaScript disabled, costs no
 * client bundle, and the sweep animation is a single CSS transform that
 * respects prefers-reduced-motion.
 */

import type {
  ChangeWithProvider,
  OfferWithProvider,
  RadarEvent,
} from "@/lib/db";
import { compact, countdown, freshness, num, unitLabel } from "@/lib/format";

interface Props {
  offers: OfferWithProvider[];
  events: RadarEvent[];
  changes: ChangeWithProvider[];
  now: number;
}

/** Deterministic placement, so a provider never jumps between renders. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const CX = 200;
const CY = 200;
const R_MAX = 168;

/** The golden angle, for spreading contacts evenly around the dial. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function Radar({
  offers,
  events,
  changes,
  now,
}: Props) {
  // Largest pool sets the outer ring, so the scale is honest rather than
  // arbitrary. If no offer publishes a pool, every point sits on the inner ring.
  const maxPool = offers.reduce((m, o) => Math.max(m, o.pool_size ?? 0), 0);

  // The pool that sets full scale, kept with its own unit for the legend.
  const largestPool = (() => {
    const pooled = offers.filter((o) => o.pool_size !== null);
    if (pooled.length === 0) return null;
    return pooled.reduce((a, b) => ((b.pool_size ?? 0) > (a.pool_size ?? 0) ? b : a));
  })();

  // One point per provider, taken from its best offer.
  const byProvider = new Map<string, OfferWithProvider>();
  for (const o of offers) {
    const slug = o.provider?.slug;
    if (!slug) continue;
    const prev = byProvider.get(slug);
    if (!prev || (o.pool_size ?? 0) > (prev.pool_size ?? 0)) {
      byProvider.set(slug, o);
    }
  }

  // A provider that changed on the most recent sweep pulses (§71).
  const newestChange = changes[0]?.detected_at;
  const changedRecently = new Set(
    changes
      .filter(
        (c) =>
          newestChange &&
          now - new Date(c.detected_at).getTime() < 20 * 60_000,
      )
      .map((c) => c.provider?.slug)
      .filter((s): s is string => Boolean(s)),
  );

  const rings = [0.34, 0.56, 0.78, 1];

  return (
    <div className="radar" role="img" aria-label={describe(offers, events, now)}>
      <svg
        viewBox="0 0 400 400"
        className="radar-svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--t-live)" stopOpacity="0.10" />
            <stop offset="70%" stopColor="var(--t-live)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="radar-sweep-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--t-live)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--t-live)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R_MAX} fill="url(#radar-glow)" />

        {/* range rings: the pool scale */}
        {rings.map((f) => (
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

        {/* bearing spokes */}
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

        {/* the sweep: one slow revolution, the only continuous motion (§45) */}
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
            strokeOpacity="0.5"
          />
        </g>

        {/* upcoming events as arcs (§71) */}
        {events.map((e) => {
          const c = countdown(e.start_at, now);
          if (!c || c.started || !e.start_at) return null;
          const daysOut = Math.min(30, c.days);
          // Each event occupies a slice sized by how far out it opens.
          const span = Math.max(0.12, Math.min(1.1, daysOut / 12));
          const start = -Math.PI / 2 + hash(e.slug) * Math.PI * 2;
          return (
            <path
              key={`arc-${e.slug}`}
              d={annularWedge(CX, CY, R_MAX * 0.99, R_MAX * 0.9, start, start + span)}
              fill="var(--t-upcoming)"
              fillOpacity="0.5"
            />
          );
        })}

        {/* one point per provider */}
        {[...byProvider.values()].map((o, i) => {
          const slug = o.provider!.slug;
          // A golden-angle spiral distributes contacts evenly across the dial.
          // Placing them by hash alone clumps most providers onto one ring,
          // because most offers publish no pool and would all share a radius.
          const angle = i * GOLDEN_ANGLE - Math.PI / 2;
          const share = maxPool > 0 ? (o.pool_size ?? 0) / maxPool : 0;
          const base =
            share > 0
              ? 0.25 + 0.72 * share
              : 0.3 + 0.58 * hash(slug);
          const r = R_MAX * base;
          const x = CX + Math.cos(angle) * r;
          const y = CY + Math.sin(angle) * r;
          const f = freshness(o.last_verified_at, now);
          const opacity =
            f === "fresh" ? 1 : f === "aging" ? 0.8 : f === "stale" ? 0.55 : 0.4;
          const color =
            o.status === "live"
              ? "var(--t-live)"
              : o.status === "upcoming"
                ? "var(--t-upcoming)"
                : "var(--t-stale)";
          const pulsing = changedRecently.has(slug);
          return (
            <g key={slug}>
              {pulsing ? (
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
              <circle cx={x} cy={y} r="3" fill={color} fillOpacity={opacity} />
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r="2" fill="var(--t-ink-3)" />
      </svg>

      <RadarLegend
        pointCount={byProvider.size}
        eventCount={events.length}
        largestPool={
          largestPool
            ? { size: largestPool.pool_size!, unit: largestPool.pool_unit }
            : null
        }
      />
    </div>
  );
}

/** A screen-reader description, since the chart itself is decorative. */
function describe(
  offers: OfferWithProvider[],
  events: RadarEvent[],
  now: number,
): string {
  const providers = new Set(
    offers.map((o) => o.provider?.slug).filter(Boolean),
  ).size;
  const upcoming = events.filter((e) => {
    const c = countdown(e.start_at, now);
    return c && !c.started;
  }).length;
  return (
    `Radar showing ${providers} providers with free access` +
    (upcoming ? ` and ${upcoming} upcoming event${upcoming === 1 ? "" : "s"}` : "") +
    "."
  );
}

function RadarLegend({
  pointCount,
  eventCount,
  largestPool,
}: {
  pointCount: number;
  eventCount: number;
  largestPool: { size: number; unit: string | null } | null;
}) {
  return (
    <dl className="radar-legend">
      <div>
        <dt className="label">Contacts</dt>
        <dd className="mono">{pointCount}</dd>
      </div>
      <div>
        <dt className="label">Upcoming arcs</dt>
        <dd className="mono">{eventCount}</dd>
      </div>
      <div>
        <dt className="label">Full-scale pool</dt>
        {/* The unit is the one the provider published, not a hard-coded one: a
            pool denominated in dollars must not be labelled as tokens (§56). */}
        <dd className="mono">
          {largestPool
            ? `${compact(largestPool.size)} ${unitLabel(largestPool.unit)}`
            : "No pooled offer"}
        </dd>
      </div>
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

/** A filled pie slice from `from` to `to`, used for the sweep wedge. */
function wedge(cx: number, cy: number, r: number, from: number, to: number): string {
  const x1 = cx + Math.cos(from) * r;
  const y1 = cy + Math.sin(from) * r;
  const x2 = cx + Math.cos(to) * r;
  const y2 = cy + Math.sin(to) * r;
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** A slice of an annulus, used for the upcoming-event arcs. */
function annularWedge(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  from: number,
  to: number,
): string {
  const large = to - from > Math.PI ? 1 : 0;
  const p = (r: number, a: number) =>
    `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
  return [
    `M ${p(rOuter, from)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p(rOuter, to)}`,
    `L ${p(rInner, to)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p(rInner, from)}`,
    "Z",
  ].join(" ");
}

/** Headline figures (§18). Every value is counted from the database. */
export function HeroStats({
  modelIds,
  cardlessProviders,
  sourcesLive,
  sourcesTotal,
  withdrawn,
}: {
  modelIds: number;
  cardlessProviders: number;
  sourcesLive: number;
  sourcesTotal: number;
  withdrawn: number;
}) {
  const stats = [
    { v: num(modelIds), l: "Free model ids" },
    { v: num(cardlessProviders), l: "Cardless providers" },
    // Both numbers, because "12 of 12" and "12 of 14" mean very different
    // things and a reader should not have to visit another page to learn which.
    { v: `${num(sourcesLive)} / ${num(sourcesTotal)}`, l: "Sources responding" },
    { v: num(withdrawn), l: "Withdrawn offers" },
  ];
  return (
    <dl className="hero-stats">
      {stats.map((s) => (
        <div key={s.l} className="hero-stat">
          <dt className="label">{s.l}</dt>
          <dd className="mono">{s.v}</dd>
        </div>
      ))}
    </dl>
  );
}
