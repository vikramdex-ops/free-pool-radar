import Link from "next/link";
import type {
  ChangeWithProvider,
  OfferWithProvider,
  RadarEvent,
} from "@/lib/db";
import {
  compact,
  countdown,
  num,
  quota,
  stampUTC,
  unitLabel,
} from "@/lib/format";
import { HeroStats } from "./RadarStats";
import { RadarFromData } from "./RadarFromData";
import { StatusBadge, TypeBadge } from "./ui";

/**
 * The hero (§18).
 *
 * It answers the product's two questions in the order a reader needs them:
 * what is free, and when does the next thing start. The radar carries the
 * shape of the data; the ticker carries the specifics, because a chart alone
 * would not tell anyone which provider is which.
 */
export function Hero({
  offers,
  events,
  changes,
  now,
  stats,
}: {
  offers: OfferWithProvider[];
  events: RadarEvent[];
  changes: ChangeWithProvider[];
  now: number;
  stats: {
    modelIds: number;
    /** Rows behind the distinct-id figure, so the population is stated (APR-059). */
    modelRows: number;
    cardlessProviders: number;
    liveProviders: number;
    liveOffers: number;
    sourcesLive: number;
    sourcesTotal: number;
    withdrawn: number;
    lastSweep: string | null;
  };
}) {
  return (
    <header className="hero">
      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-eyebrow">
              <span className="dot dot-live tick" aria-hidden="true" />
              Live intelligence for $0 AI inference
            </p>

            <h1 className="hero-title">
              Every free AI inference pool.
              <br />
              Every disappearing quota.
              <br />
              <span className="hero-title-accent">One live radar.</span>
            </h1>

            <p className="hero-lede">
              Discover free pools before they vanish. We monitor shared pools,
              free model endpoints, sponsored access, promotional credits and
              keyless routes &mdash; and the record stays when they do.
            </p>

            <HeroStats {...stats} />

            <div className="hero-actions">
              <Link href="#live" className="btn">
                What&rsquo;s free now
              </Link>
              <Link href="/methodology" className="btn">
                How we verify
              </Link>
              {/* Raw JSON with no explanation is a hostile first step. This
                  lands on the developers page, which explains the endpoints and
                  links to them in context. */}
              <Link href="/developers" className="btn">
                Developers &amp; API
              </Link>
            </div>
          </div>

          <div className="hero-dial">
            <RadarFromData
              offers={offers}
              events={events}
              changes={changes}
              now={now}
            />
          </div>
        </div>

        <LiveTicker offers={offers} events={events} now={now} />
      </div>
    </header>
  );
}

/**
 * The ticker (§18). Four lines, factual, each traceable to a stored row.
 * Rotating through providers is motion that carries information, so it is
 * allowed; it stops entirely under prefers-reduced-motion.
 */
function LiveTicker({
  offers,
  events,
  now,
}: {
  offers: OfferWithProvider[];
  events: RadarEvent[];
  now: number;
}) {
  const lines = buildTickerLines(offers, events, now);

  return (
    <div className="ticker" aria-live="off">
      <div className="ticker-head">
        <span className="badge badge-live">
          <span className="dot" aria-hidden="true" />
          LIVE
        </span>
      </div>
      <ul className="ticker-list">
        {lines.map((l) => (
          <li key={l.key} className="ticker-row">
            <span className="ticker-name">{l.name}</span>
            <span className="ticker-detail mono">{l.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildTickerLines(
  offers: OfferWithProvider[],
  events: RadarEvent[],
  now: number,
) {
  const lines: { key: string; name: string; detail: string }[] = [];
  // One line per provider: repeating the same provider twice wastes the strip
  // and makes it look like there is less to see than there is.
  const used = new Set<string>();

  const claim = (slug: string | null | undefined) => {
    const key = slug ?? "?";
    if (used.has(key)) return false;
    used.add(key);
    return true;
  };

  // Upcoming pools first: they are the most time-sensitive thing we know.
  for (const e of events) {
    const c = countdown(e.start_at, now);
    if (!c || c.started) continue;
    if (!claim(e.provider?.slug)) continue;
    lines.push({
      key: `ev-${e.slug}`,
      name: e.provider?.name ?? "Upcoming event",
      detail:
        `${compact(e.pool_size ?? 0)} ${unitLabel(e.unit)} pool · ` +
        `starts in ${c.days}D ${String(c.hours).padStart(2, "0")}H`,
    });
  }

  // Then the largest pooled offer that is actually open.
  const pooled = [...offers]
    .filter((o) => o.status === "live" && o.pool_remaining !== null)
    .sort((a, b) => (b.pool_remaining ?? 0) - (a.pool_remaining ?? 0))
    .find((o) => claim(o.provider?.slug));
  if (pooled) {
    lines.push({
      key: `pool-${pooled.id}`,
      name: pooled.provider?.name ?? "Pool",
      detail: `${compact(pooled.pool_remaining)} ${unitLabel(pooled.pool_unit)} remaining`,
    });
  }

  // Then the largest per-provider free model count, which is the other number
  // a reader actually compares providers on.
  const biggest = [...offers]
    .filter((o) => o.status === "live" && (o.provider?.free_model_count ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.provider?.free_model_count ?? 0) - (a.provider?.free_model_count ?? 0),
    )
    .find((o) => claim(o.provider?.slug));
  if (biggest) {
    lines.push({
      key: `models-${biggest.provider!.slug}`,
      name: biggest.provider!.name,
      detail: `${num(biggest.provider!.free_model_count)} free models listed`,
    });
  }

  // A rate-limited free tier, so the ticker shows the common case too.
  const limited = offers
    .filter((o) => o.status === "live" && (o.rpm !== null || o.rpd !== null))
    .find((o) => claim(o.provider?.slug));
  if (limited) {
    lines.push({
      key: `rate-${limited.id}`,
      name: limited.provider?.name ?? "Provider",
      detail: quota(limited) ?? "rate limited",
    });
  }

  return lines.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* upcoming (§20)                                                      */
/* ------------------------------------------------------------------ */

export function Upcoming({
  events,
  offers,
  now,
}: {
  events: RadarEvent[];
  offers: OfferWithProvider[];
  now: number;
}) {
  const upcoming = events
    .map((e) => ({ e, c: countdown(e.start_at, now) }))
    .filter((x) => x.c && !x.c.started)
    .sort((a, b) => (a.c!.days - b.c!.days));

  // An upcoming pool is recorded twice: once as an event with the schedule and
  // once as an offer with the access terms. Rendering both would show the same
  // 10B pool twice, so an offer already described by an event is skipped and
  // only the event card is shown.
  const coveredByEvent = new Set(
    upcoming.flatMap(({ e }) => [
      ...e.models,
      `${e.provider?.slug ?? ""}::${e.slug}`,
    ]),
  );
  const upcomingOffers = offers.filter(
    (o) =>
      o.status === "upcoming" &&
      !coveredByEvent.has(o.model_label) &&
      !coveredByEvent.has(
        `${o.provider?.slug ?? ""}::${o.model_label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      ) &&
      o.start_at !== null &&
      countdown(o.start_at, now)?.started !== true,
  );

  if (upcoming.length === 0 && upcomingOffers.length === 0) {
    // A full-height empty block for an empty section makes the page read as
    // unfinished. One slim strip states the fact and the consequence, and
    // steps out of the way. It fills with real cards only when real events
    // exist - it is never padded with placeholders.
    return (
      <p className="empty-strip">
        <span className="dot" aria-hidden="true" />
        No announced pools right now. Checked again at the next sweep.
      </p>
    );
  }

  return (
    <div className="upcoming-grid">
      {upcoming.map(({ e, c }) => (
        <article key={e.slug} className="panel upcoming-card">
          <div className="upcoming-top">
            <span className="label">{e.provider?.name ?? e.slug}</span>
            <StatusBadge
              status={
                e.status === "upcoming"
                  ? "upcoming"
                  : e.status === "live"
                    ? "live"
                    : e.status === "exhausted"
                      ? "exhausted"
                      : "ended"
              }
            />
          </div>

          {e.models.length ? (
            <h3 className="upcoming-model mono">{e.models.join(", ")}</h3>
          ) : (
            <h3 className="upcoming-model">{e.name}</h3>
          )}

          {e.pool_size !== null ? (
            <p className="upcoming-pool mono">
              {compact(e.pool_size)} {unitLabel(e.unit)}
            </p>
          ) : null}

          <div className="upcoming-countdown">
            <p className="label">Starts in</p>
            <div className="mono" style={{ display: "flex", gap: "0.5rem", fontSize: "1.5rem", fontWeight: 600 }}>
              <span>{String(c!.days).padStart(2, "0")}D</span>
              <span style={{ color: "var(--t-ink-3)" }}>:</span>
              <span>{String(c!.hours).padStart(2, "0")}H</span>
              <span style={{ color: "var(--t-ink-3)" }}>:</span>
              <span>{String(c!.minutes).padStart(2, "0")}M</span>
            </div>
          </div>

          <dl className="upcoming-facts">
            {e.eligibility ? (
              <div>
                <dt className="label">Eligibility</dt>
                <dd>{e.eligibility}</dd>
              </div>
            ) : null}
            {e.requirements ? (
              <div>
                <dt className="label">Requirements</dt>
                <dd>{e.requirements}</dd>
              </div>
            ) : null}
            {e.exhaustion_condition ? (
              <div>
                <dt className="label">When it runs out</dt>
                <dd>{e.exhaustion_condition}</dd>
              </div>
            ) : null}
            <div>
              <dt className="label">Opens</dt>
              <dd className="mono">{stampUTC(e.start_at)}</dd>
            </div>
          </dl>

          {e.official_url ? (
            <a
              href={e.official_url}
              className="link-ev"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              View event <span aria-hidden="true">→</span>
            </a>
          ) : null}
        </article>
      ))}

      {upcomingOffers.map((o) => (
        <article key={o.id} className="panel upcoming-card">
          <div className="upcoming-top">
            <span className="label">{o.provider?.name}</span>
            <TypeBadge type={o.offer_type} />
          </div>
          <h3 className="upcoming-model mono">{o.model_label}</h3>
          {o.pool_size !== null ? (
            <p className="upcoming-pool mono">
              {compact(o.pool_size)} {unitLabel(o.pool_unit)}
            </p>
          ) : null}
          <div className="upcoming-facts">
            <div>
              <dt className="label">Opens</dt>
              <dd className="mono">{stampUTC(o.start_at)}</dd>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
