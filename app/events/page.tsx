import type { Metadata } from "next";
import Link from "next/link";
import { getEvents, type RadarEvent } from "@/lib/db";
import { JsonLd, SITE_URL } from "@/components/JsonLd";
import { compact, countdown, stampUTC } from "@/lib/format";
import { EvidenceLink, PoolMeter, ReadError } from "@/components/ui";

/** Event status is its own union, and it is wider than an offer's: an event can
 *  be cancelled, which no offer can be. Mapped here rather than cast at the
 *  call site so the difference is visible. */
const EVENT_STATUS: Record<string, string> = {
  upcoming: "badge-upcoming",
  live: "badge-live",
  ended: "badge-ended",
  cancelled: "badge-ended",
  exhausted: "badge-ended",
  suspended: "badge-stale",
};

const EVENT_STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  live: "Running",
  ended: "Ended",
  cancelled: "Cancelled",
  exhausted: "Exhausted",
  suspended: "Suspended",
};

/** Countdown as a phrase. `countdown` returns parts; a reader wants the whole. */
function untilLabel(c: { days: number; hours: number; minutes: number }): string {
  if (c.days > 0) return `${c.days} day${c.days === 1 ? "" : "s"}`;
  if (c.hours > 0) return `${c.hours} hour${c.hours === 1 ? "" : "s"}`;
  return `${c.minutes} minute${c.minutes === 1 ? "" : "s"}`;
}

export const metadata: Metadata = {
  title: "Events",
  description:
    "Every promotional event, sponsored pool and temporary free allocation we track — upcoming, running, and finished.",
  alternates: { canonical: "/events" },
};

export const revalidate = 300;

/**
 * The event index.
 *
 * The spec defines a page per event but never names an index, which is a gap:
 * an event that is announced and then never mentioned on the homepage is
 * invisible, and a finished event that is not listed anywhere is the same
 * failure the ended-offers archive exists to prevent (§16).
 *
 * So every event is listed, and the three states are kept visibly separate
 * rather than merged into a single "events" list. A reader asking "is
 * anything running right now" and a reader asking "what has already ended" are
 * asking different questions, and a chronological list answers only the second.
 */
export default async function EventsPage() {
  const { data: events, error: eventsError } = await getEvents();
  const now = Date.now();

  const upcoming = events.filter(
    (e) => e.status === "upcoming" && (!e.start_at || new Date(e.start_at).getTime() > now),
  );
  const running = events.filter((e) => {
    if (e.status === "live") return true;
    if (!e.start_at) return false;
    const start = new Date(e.start_at).getTime();
    const end = e.end_at ? new Date(e.end_at).getTime() : Infinity;
    return start <= now && now < end;
  });
  // Everything else has finished, was cancelled, or has no start date we can
  // place. It is kept and shown, never dropped: an event that ended is the
  // evidence that the free tier around it ended too.
  const finished = events.filter((e) => !upcoming.includes(e) && !running.includes(e));

  return (
    <main id="main" className="wrap">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Promotional events and pooled free AI access",
          itemListElement: events.map((e, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: e.name,
            url: `${SITE_URL}/events/${e.slug}`,
          })),
        }}
      />
      <header className="page-head">
        <p className="label">Events</p>
        <h1 className="page-title">Promotional events and pooled access</h1>
        <p className="page-lede">
          Temporary and sponsored access is the part of the free landscape most
          likely to disappear without notice, so it is tracked separately from
          permanent free tiers and kept after it ends.
        </p>
      </header>

      {eventsError ? (
        <div className="sect" style={{ paddingTop: "1.5rem" }}>
          <ReadError what="Events" />
        </div>
      ) : (
        <>
          <nav className="event-jump" aria-label="Event sections">
        <a href="#running">Running now ({running.length})</a>
        <a href="#upcoming">Upcoming ({upcoming.length})</a>
        <a href="#finished">Finished ({finished.length})</a>
      </nav>

      <section id="running" className="sect">
        <div className="sect-head">
          <h2 className="sect-title">Running now</h2>
        </div>
        {running.length === 0 ? (
          <p className="annot">
            No event is running at the moment this page was read. That is a
            statement about now, not a forecast.
          </p>
        ) : (
          <EventList events={running} now={now} />
        )}
      </section>

      <section id="upcoming" className="sect">
        <div className="sect-head">
          <h2 className="sect-title">Upcoming</h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="annot">
            Nothing announced with a start date in the future. Providers do
            announce these without warning, so an empty list is not a promise.
          </p>
        ) : (
          <EventList events={upcoming} now={now} />
        )}
      </section>

      <section id="finished" className="sect">
        <div className="sect-head">
          <h2 className="sect-title">Finished</h2>
          <p className="sect-note">
            Kept permanently. An event that ended is part of the record, and
            removing it would quietly make the site look steadier than the
            landscape is.
          </p>
        </div>
        {finished.length === 0 ? (
          <p className="annot">No event we track has finished.</p>
        ) : (
          <EventList events={finished} now={now} />
        )}
      </section>
        </>
      )}
    </main>
  );
}

function EventList({
  events,
  now,
}: {
  events: RadarEvent[];
  now: number;
}) {
  return (
    <ul className="event-list">
      {events.map((e) => {
        const c = countdown(e.start_at, now);
        return (
          <li key={e.id} className="panel event-row">
            <div className="event-head">
              <div>
                {e.provider ? (
                  <p className="annot">
                    <Link href={`/providers/${e.provider.slug}`} className="link">
                      {e.provider.name}
                    </Link>
                  </p>
                ) : null}
                <h3 className="event-name">
                  <Link href={`/events/${e.slug}`} className="link">
                    {e.name}
                  </Link>
                </h3>
              </div>
              <span
                className={`badge ${EVENT_STATUS[e.status] ?? "badge-stale"}`}
              >
                <span className="dot" aria-hidden="true" />
                {EVENT_STATUS_LABEL[e.status] ?? e.status}
              </span>
            </div>

            {e.description ? <p className="event-desc">{e.description}</p> : null}

            <dl className="facts" style={{ margin: "0.875rem 0 0" }}>
              <div>
                <dt className="label">Starts</dt>
                <dd className="mono">
                  {stampUTC(e.start_at) ?? "Not stated"}
                  {c && !c.started ? (
                    <span className="annot" style={{ display: "block" }}>
                      in {untilLabel(c)}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="label">Ends</dt>
                <dd className="mono">{stampUTC(e.end_at) ?? "Not stated"}</dd>
              </div>
              <div>
                <dt className="label">Pool</dt>
                <dd className="mono">
                  {e.pool_size === null
                    ? "Not stated"
                    : `${compact(e.pool_size)} ${e.unit || "units"}`}
                </dd>
              </div>
              <div>
                <dt className="label">Last verified</dt>
                <dd className="mono">{stampUTC(e.last_verified_at) ?? "Never"}</dd>
              </div>
            </dl>

            {e.pool_size !== null && e.pool_remaining !== null ? (
              <div style={{ marginTop: "0.875rem" }}>
                <PoolMeter
                  remaining={compact(e.pool_remaining)}
                  size={compact(e.pool_size)}
                  unit={e.unit || "units"}
                  // The proportion is computed from the two figures shown rather
                  // than stored, so the meter cannot disagree with the numbers
                  // printed above it.
                  pct={
                    e.pool_size && e.pool_size > 0
                      ? Math.round((e.pool_remaining / e.pool_size) * 100)
                      : null
                  }
                />
              </div>
            ) : null}

            <div className="event-foot">
              {e.models.length > 0 ? (
                <p className="annot">
                  {e.models.length} model{e.models.length === 1 ? "" : "s"} in
                  this event
                </p>
              ) : (
                <p className="annot">No models listed for this event</p>
              )}
              <EvidenceLink href={e.official_url} kind="Event page" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
