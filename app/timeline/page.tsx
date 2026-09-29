import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, EvidenceLink } from "@/components/ui";
import { getTimeline } from "@/lib/db";
import { CHANGE_LABEL, FIELD_LABEL, ago, stampUTC } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Timeline",
  description:
    "Every recorded change to free AI access, newest first: new offers, models added and removed, quota changes, card requirements, free tiers started and ended.",
  alternates: { canonical: "/timeline" },
};

/** §28. A global, filterable history of everything that moved. */
export default async function TimelinePage() {
  const now = Date.now();
  const changes = await getTimeline(300);

  // Grouped by UTC day, so the timeline reads as a log rather than a feed.
  const byDay = new Map<string, typeof changes>();
  for (const c of changes) {
    const day = (stampUTC(c.detected_at) ?? "undated").split(" · ")[0];
    const list = byDay.get(day) ?? [];
    list.push(c);
    byDay.set(day, list);
  }

  return (
    <>
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">History</p>
          <h1 className="page-title">Timeline</h1>
          <p className="page-lede">
            Every difference detected between two monitoring sweeps. This is the
            part of the product that gets more useful over time: the same query
            answered a year from now will show what changed since.
          </p>
        </header>

        {changes.length === 0 ? (
          <EmptyState title="No changes recorded">
            No differences have been detected between sweeps yet. Once a quota,
            card requirement, model list or status moves, it appears here with
            both values.
          </EmptyState>
        ) : (
          <div className="timeline">
            {[...byDay.entries()].map(([day, rows]) => (
              <section key={day} className="timeline-day">
                <h2 className="timeline-date mono">{day}</h2>
                <ol className="feed">
                  {rows.map((c) => (
                    <li key={c.id} className="panel feed-row">
                      <div className="feed-when">
                        <p className="mono feed-stamp">
                          {(stampUTC(c.detected_at) ?? "").split(" · ")[1] ?? ""}
                        </p>
                        <p className="annot mono">{ago(c.detected_at, now)}</p>
                      </div>
                      <div className="feed-what">
                        <p className="label" style={{ color: "var(--t-upcoming)" }}>
                          {CHANGE_LABEL[c.change_type] ?? c.change_type}
                        </p>
                        <p className="strong">
                          {c.provider ? (
                            <Link href={`/providers/${c.provider.slug}`} className="link">
                              {c.provider.name}
                            </Link>
                          ) : (
                            "Unattributed"
                          )}
                        </p>
                        {/* Name the subject, or several different events read as
                            the same line. */}
                        {c.offer ? (
                          <p className="annot mono">{c.offer.model_label}</p>
                        ) : null}
                        {c.field && c.change_type !== "new" ? (
                          <p className="annot">
                            {FIELD_LABEL[c.field] ?? c.field}:{" "}
                            <span className="mono">
                              {c.old_value ?? "not stated"}
                            </span>{" "}
                            →{" "}
                            <span className="mono strong">
                              {c.new_value ?? "not stated"}
                            </span>
                          </p>
                        ) : c.change_type === "new" ? (
                          <p className="annot">
                            added as {c.new_value?.replace(/_/g, " ")}
                          </p>
                        ) : null}
                        {c.evidence ? <p className="annot">{c.evidence}</p> : null}
                      </div>
                      <div className="feed-source">
                        {c.offer_id ? (
                          <EvidenceLink offerId={c.offer_id} />
                        ) : c.source_url ? (
                          <a
                            href={c.source_url}
                            className="link-ev"
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                          >
                            Source <span aria-hidden="true">→</span>
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
