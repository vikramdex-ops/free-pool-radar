import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EvidenceLink, PoolMeter, StatusBadge } from "@/components/ui";
import { JsonLd, SITE_URL } from "@/components/JsonLd";
import { getEvent } from "@/lib/db";
import {
  NOT_STATED,
  ago,
  compact,
  countdown,
  num,
  stampUTC,
  unitLabel,
} from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event not found" };
  const size = event.pool_size
    ? ` — ${compact(event.pool_size)} ${unitLabel(event.unit)}`
    : "";
  return {
    title: `${event.provider?.name ?? "Free"} AI API pool${size}`,
    description:
      event.description ??
      `Current status, pool size, models, requirements, start date and verification history for this free AI inference event.`,
    alternates: { canonical: `/events/${event.slug}` },
  };
}

/** §40, §7.4. One indexable page per pool or event. */
export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = Date.now();
  const event = await getEvent(slug);
  if (!event) notFound();

  const c = countdown(event.start_at, now);
  const pct =
    event.pool_size && event.pool_remaining !== null
      ? (event.pool_remaining / event.pool_size) * 100
      : null;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: event.name,
          url: `${SITE_URL}/events/${event.slug}`,
          ...(event.start_at ? { startDate: event.start_at } : null),
          ...(event.end_at ? { endDate: event.end_at } : null),
        }}
      />
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">
            <Link href="/#soon">Events</Link> / {event.slug}
          </p>
          <h1 className="page-title">{event.name}</h1>
          {event.description ? <p className="page-lede">{event.description}</p> : null}

          <div
            className="inline-flex"
            style={{ gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}
          >
            <StatusBadge
              status={
                event.status === "upcoming"
                  ? "upcoming"
                  : event.status === "live"
                    ? "live"
                    : event.status === "exhausted"
                      ? "exhausted"
                      : event.status === "suspended"
                        ? "suspended"
                        : "ended"
              }
            />
            {event.provider ? (
              <Link href={`/providers/${event.provider.slug}`} className="chip">
                {event.provider.name}
              </Link>
            ) : null}
            <EvidenceLink href={event.official_url} kind="Event" />
          </div>
        </header>

        <div className="sect" style={{ paddingTop: "1.5rem" }}>
          {c && !c.started ? (
            <div className="panel upcoming-card" style={{ marginBottom: "2rem" }}>
              <p className="label">Starts in</p>
              <div
                className="mono"
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  fontSize: "2rem",
                  fontWeight: 600,
                  marginTop: "0.5rem",
                }}
              >
                <span>{String(c.days).padStart(2, "0")}D</span>
                <span style={{ color: "var(--t-ink-3)" }}>:</span>
                <span>{String(c.hours).padStart(2, "0")}H</span>
                <span style={{ color: "var(--t-ink-3)" }}>:</span>
                <span>{String(c.minutes).padStart(2, "0")}M</span>
              </div>
              <p className="annot mono" style={{ marginTop: "0.5rem" }}>
                Opens {stampUTC(event.start_at)}
              </p>
            </div>
          ) : null}

          {event.pool_size !== null ? (
            <div style={{ marginBottom: "2rem", maxWidth: "32rem" }}>
              <p className="label" style={{ marginBottom: "0.5rem" }}>
                Pool capacity
              </p>
              <PoolMeter
                remaining={num(event.pool_remaining)}
                size={num(event.pool_size)}
                unit={unitLabel(event.unit)}
                pct={pct}
              />
            </div>
          ) : null}

          <dl className="facts">
            <div>
              <dt className="label">Pool size</dt>
              <dd className="mono">
                {event.pool_size !== null
                  ? `${num(event.pool_size)} ${unitLabel(event.unit)}`
                  : NOT_STATED}
              </dd>
            </div>
            <div>
              <dt className="label">Remaining</dt>
              <dd className="mono">
                {event.pool_remaining !== null
                  ? `${num(event.pool_remaining)} ${unitLabel(event.unit)}`
                  : NOT_STATED}
              </dd>
            </div>
            <div>
              <dt className="label">Opens</dt>
              <dd className="mono">{stampUTC(event.start_at) ?? NOT_STATED}</dd>
            </div>
            <div>
              <dt className="label">Closes</dt>
              <dd className="mono">
                {event.end_at ? stampUTC(event.end_at) : "No end date published"}
              </dd>
            </div>
            <div>
              <dt className="label">Eligibility</dt>
              <dd>{event.eligibility ?? NOT_STATED}</dd>
            </div>
            <div>
              <dt className="label">Requirements</dt>
              <dd>{event.requirements ?? NOT_STATED}</dd>
            </div>
            <div>
              <dt className="label">When it runs out</dt>
              <dd>{event.exhaustion_condition ?? NOT_STATED}</dd>
            </div>
            <div>
              <dt className="label">Last verified</dt>
              <dd className="mono">
                {ago(event.last_verified_at, now) ?? "Never"}
              </dd>
            </div>
          </dl>

          {event.models.length ? (
            <>
              <h2 className="sect-title" style={{ marginTop: "2.5rem" }}>
                Models in this event
              </h2>
              <ul className="inline-flex" style={{ gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
                {event.models.map((m) => (
                  <li key={m} className="chip mono">
                    {m}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
