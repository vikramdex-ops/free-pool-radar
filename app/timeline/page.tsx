import type { Metadata } from "next";
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

/** Â§28. A global, filterable history of everything that moved. */
export default async function TimelinePage() {
  const now = Date.now();
  const changes = await getTimeline(300);

  // Grouped by UTC day, so the timeline reads as a log rather than a feed.
  const byDay = new Map<string, typeof changes>();
  for (const c of changes) {
    const day = (stampUTC(c.detected_at) ?? "undated").split(" Â· ")[0];
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
                          {(stampUTC(c.detected_at) ?? "").split(" Â· ")[1] ?? ""}
                        </p>
                        <p className="annot mono">{ago(c.detected_at, now)}</p>
                      </div>
                      <div className="feed-what">
                        <p className="label" style={{ color: "var(--t-upcoming)" }}>
                          {CHANGE_LABEL[c.change_type] ?? c.change_type}
                        </p>
                        <p className="strong">
                          {c.provider ? (
                            <a href={`/providers/${c.provider.slug}`} className="link">
                              {c.provider.name}
                            </a>
                          ) : (
                            "Unattributed"
                          )}
                        </p>
                        {c.field ? (
                          <p className="annot mono">
                            {FIELD_LABEL[c.field] ?? c.field}:{" "}
                            {c.old_value ?? "not stated"} â†’ {c.new_value ?? "not stated"}
                          </p>
                        ) : null}
                        {c.evidence ? <p className="annot">{c.evidence}</p> : null}
                      </div>
                      <div className="feed-source">
                        <EvidenceLink href={c.source_url} kind="Evidence" />
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
