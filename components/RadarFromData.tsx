import type { ChangeWithProvider, OfferWithProvider, RadarEvent } from "@/lib/db";
import { compact, countdown, freshness, unitLabel } from "@/lib/format";
import { Radar, type RadarArc, type RadarProvider } from "./RadarDial";

/**
 * The golden angle, defined here rather than imported.
 *
 * RadarDial is a client component, and a value imported across that boundary
 * arrives undefined on the server. Every contact then got a NaN angle, the SVG
 * emitted `cx="NaN"`, and the resulting render error left the island
 * unhydrated — so the pointer interactions silently did nothing.
 */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/**
 * Turns database rows into radar geometry.
 *
 * Kept on the server so the numbers come from the same read as the rest of the
 * page, and so the client component receives plain data rather than a query.
 */
export function RadarFromData({
  offers,
  events,
  changes,
  now,
}: {
  offers: OfferWithProvider[];
  events: RadarEvent[];
  changes: ChangeWithProvider[];
  now: number;
}) {
  const maxPool = offers.reduce((m, o) => Math.max(m, o.pool_size ?? 0), 0);

  // One contact per provider, taken from its best offer.
  const byProvider = new Map<string, OfferWithProvider>();
  for (const o of offers) {
    const slug = o.provider?.slug;
    if (!slug) continue;
    const prev = byProvider.get(slug);
    if (!prev || (o.pool_size ?? 0) > (prev.pool_size ?? 0)) {
      byProvider.set(slug, o);
    }
  }

  const newestChange = changes[0]?.detected_at;
  const changedRecently = new Set(
    changes
      .filter(
        (c) => newestChange && now - new Date(c.detected_at).getTime() < 20 * 60_000,
      )
      .map((c) => c.provider?.slug)
      .filter((s): s is string => Boolean(s)),
  );

  const contacts: Omit<RadarProvider, "angle">[] = [...byProvider.values()].map(
    (o) => {
      const share = maxPool > 0 ? (o.pool_size ?? 0) / maxPool : 0;
      const f = freshness(o.last_verified_at, now);
      return {
        slug: o.provider!.slug,
        name: o.provider!.name,
        // Pool scale sets the radius. Most providers publish no pool at all, so
        // giving them all one radius piles two dozen contacts onto a single
        // tight ring. They are spread across a band instead, which keeps the
        // dial readable without pretending to a precision it does not have.
        r: share > 0 ? 0.52 + 0.44 * share : 0.3 + 0.5 * fnv(o.provider!.slug),
        status:
          o.status === "live" ? "live" : o.status === "upcoming" ? "upcoming" : "other",
        fresh: f === "fresh" ? 1 : f === "aging" ? 0.8 : f === "stale" ? 0.55 : 0.4,
        pool:
          o.pool_size !== null
            ? `${compact(o.pool_size)} ${unitLabel(o.pool_unit)}`
            : null,
        pulse: changedRecently.has(o.provider!.slug),
      };
    },
  );

  const arcs: RadarArc[] = events
    .map((e) => ({ e, c: countdown(e.start_at, now) }))
    .filter((x) => x.c && !x.c.started)
    .map(({ e, c }) => {
      // Spread around the rim, placed by a stable hash of the slug so an event
      // keeps its position between renders.
      const h = fnv(e.slug);
      return {
        slug: e.slug,
        label: e.name,
        start: h,
        // Wider for further-out events, so the arc width means something.
        span: Math.max(0.05, Math.min(0.28, (c!.days / 30) * 0.28)),
        daysOut: c!.days,
      };
    });

  const largest = offers
    .filter((o) => o.pool_size !== null)
    .reduce<OfferWithProvider | null>(
      (a, b) => ((b.pool_size ?? 0) > (a?.pool_size ?? -1) ? b : a),
      null,
    );

  return (
    <Radar
      providers={layout(contacts)}
      arcs={arcs}
      largestPool={
        largest ? `${compact(largest.pool_size)} ${unitLabel(largest.pool_unit)}` : null
      }
    />
  );
}

/**
 * Places each contact on a golden-angle spiral.
 *
 * A spiral rather than a hash because most providers publish no pool, so a
 * hash-based radius would pile most of them onto a single ring and the dial
 * would read as a clump rather than as contacts.
 */
function layout(contacts: Omit<RadarProvider, "angle">[]): RadarProvider[] {
  return contacts.map((c, i) => ({
    ...c,
    angle: i * GOLDEN - Math.PI / 2,
  }));
}

/** Deterministic placement, so an event never jumps between renders. */
function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
