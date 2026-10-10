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
import { ParticleField, TiltCard, StaggerContainer } from "./Cinematic";

/**
 * The hero (§18) - Enhanced with 3D cinematic design.
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
    <header className="hero perspective-container">
      <ParticleField count={30} />
      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-copy depth-layer">
            <p className="hero-eyebrow">
              <span className="dot dot-live tick" aria-hidden="true" />
              Every free route, verified live
            </p>

            <h1 className="hero-title">
              Free inference runs out.
              <br />
              <span className="hero-title-accent">We keep the record.</span>
            </h1>

            <p className="hero-lede">
              Shared pools, free model endpoints, sponsored credits,
              promotional credits and keyless routes. Each one is read from the
              source that published it, stamped with the moment it was last
              confirmed, and kept long after it closes.
            </p>

            <HeroStats {...stats} />

            <div className="hero-actions">
              <Link href="#live" className="btn">
                What&rsquo;s free right now
              </Link>
              <Link href="/methodology" className="btn">
                How we verify
              </Link>
              <Link href="/developers" className="btn">
                Developers &amp; API
              </Link>
            </div>
          </div>

          <div className="hero-dial float-element">
            <div className="radar-container">
              <RadarFromData
                offers={offers}
                events={events}
                changes={changes}
                now={now}
              />
            </div>
          </div>
        </div>

        <LiveTicker offers={offers} events={events} now={now} />
      </div>
    </header>
  );
}

/**
 * The ticker (§18) - Enhanced with glassmorphism.
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
  const used = new Set<string>();

  const claim = (slug: string | null | undefined) => {
    const key = slug ?? "?";
    if (used.has(key)) return false;
    used.has(key);
    return true;
  };

  const upcomingEvents = events
    .map((e) => ({ e, c: countdown(e.start_at, now) }))
    .filter((x) => x.c && !x.c.started)
    .sort((a, b) => (a.c!.days - b.c!.days));

  for (const { e, c } of upcomingEvents) {
    if (lines.length >= 4) break;
    if (!claim(e.provider?.slug)) continue;
    const model = e.models[0] ?? e.name;
    const time = c!.days > 0 ? `${c!.days}d` : `${c!.hours}h ${c!.minutes}m`;
    lines.push({
      key: e.slug,
      name: e.provider?.name ?? e.slug,
      detail: `${model} opens in ${time}`,
    });
  }

  const live = offers
    .filter((o) => o.status === "live" && o.pool_size !== null)
    .sort((a, b) => (b.pool_size ?? 0) - (a.pool_size ?? 0));

  for (const o of live) {
    if (lines.length >= 4) break;
    if (!claim(o.provider?.slug)) continue;
    const pool = `${compact(o.pool_size)} ${unitLabel(o.pool_unit)}`;
    lines.push({
      key: o.id.toString(),
      name: o.provider?.name ?? "Unknown",
      detail: `${o.model_label} · ${pool}`,
    });
  }

  return lines;
}

/**
 * Upcoming section - Enhanced with 3D card effects
 */
export function Upcoming({
  offers,
  events,
  now,
}: {
  offers: OfferWithProvider[];
  events: RadarEvent[];
  now: number;
}) {
  const upcoming = events
    .map((e) => ({ e, c: countdown(e.start_at, now) }))
    .filter((x) => x.c && !x.c.started)
    .sort((a, b) => (a.c!.days - b.c!.days));

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
    return (
      <p className="empty-strip">
        <span className="dot" aria-hidden="true" />
        No announced pools right now. Checked again at the next sweep.
      </p>
    );
  }

  return (
    <StaggerContainer className="upcoming-grid">
      {upcoming.map(({ e, c }) => (
        <TiltCard key={e.slug} className="stagger-item">
          <article className="panel panel-enhanced upcoming-card">
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
        </TiltCard>
      ))}

      {upcomingOffers.map((o) => (
        <TiltCard key={o.id} className="stagger-item">
          <article className="panel panel-enhanced upcoming-card">
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
        </TiltCard>
      ))}
    </StaggerContainer>
  );
}
