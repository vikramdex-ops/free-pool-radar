import type { Metadata } from "next";
import { groupChanges, GroupRow } from "@/components/Feed";
import { EmptyState, ReadError } from "@/components/ui";
import { getTimeline } from "@/lib/db";
import { stampUTC } from "@/lib/format";

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
  const { data: changes, error: changesError } = await getTimeline(300);

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

        {changesError ? (
          <ReadError what="Change history" />
        ) : changes.length === 0 ? (
          <EmptyState title="No changes recorded">
            No differences have been detected between sweeps yet. Once a quota,
            card requirement, model list or status moves, it appears here with
            both values.
          </EmptyState>
        ) : (
          <div className="timeline">
            {/* DEC-T23-GROUPCOLLAPSE: duplicate-collapsing inside each day.
                Rows sharing a provider, a change type and a moment render as
                one entry with the routes beneath it, via the same GroupRow
                the feeds use — one rendering path, not two. */}
            {[...byDay.entries()].map(([day, rows]) => {
              const groups = groupChanges(rows);
              return (
                <section key={day} className="timeline-day">
                  <h2 className="timeline-date mono">{day}</h2>
                  <ol className="feed">
                    {groups.map((g) => (
                      <GroupRow key={g.key} group={g} now={now} />
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
