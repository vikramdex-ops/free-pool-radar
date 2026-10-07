import Link from "next/link";
import type { ChangeWithProvider, OfferWithProvider } from "@/lib/db";
import { CHANGE_LABEL, FIELD_LABEL, ago, stampUTC } from "@/lib/format";
import { EmptyState, EvidenceLink } from "./ui";

/**
 * What is new and what changed (§22, §23).
 *
 * Two problems this component exists to solve.
 *
 * The first is that a change is only meaningful with its subject. A sweep that
 * discovers eighteen new routes at one provider produces eighteen rows, and
 * every one of them reads "offer: not stated → rotating_free_model" against the
 * same source URL. A reader sees four identical lines and concludes the page is
 * broken, when in fact four different models were found. So the subject is
 * always named, and rows sharing a provider, a change type and a moment are
 * grouped into one entry with the routes listed beneath it.
 *
 * The second is that "not stated" is the wrong thing to print for a new offer.
 * There was no previous value, so the row should say the route was added rather
 * than showing an arrow from nothing.
 *
 * The history is derived from the change log rather than assembled from current
 * state, which is what makes it honest: a row exists because a difference was
 * detected between two observations.
 */

interface Group {
  key: string;
  provider: ChangeWithProvider["provider"];
  changeType: string;
  rows: ChangeWithProvider[];
  first: ChangeWithProvider;
}

/**
 * Groups changes a reader would otherwise see as identical.
 *
 * Only consecutive rows are merged, and only within a short window, so a
 * provider that changes something today and again next week still shows as two
 * separate events. Merging across time would quietly rewrite history.
 */
export function groupChanges(
  changes: ChangeWithProvider[],
  windowMs = 6 * 3600_000,
): Group[] {
  const groups: Group[] = [];
  for (const c of changes) {
    const last = groups[groups.length - 1];
    const sameSubject =
      last !== undefined &&
      last.changeType === c.change_type &&
      last.provider?.slug === c.provider?.slug &&
      Math.abs(
        new Date(last.first.detected_at).getTime() -
          new Date(c.detected_at).getTime(),
      ) < windowMs;

    if (sameSubject && last) {
      last.rows.push(c);
    } else {
      groups.push({
        key: `${c.provider?.slug ?? "?"}-${c.change_type}-${c.id}`,
        provider: c.provider,
        changeType: c.change_type,
        rows: [c],
        first: c,
      });
    }
  }
  return groups;
}

/** How many subjects to name before collapsing the rest into a count. */
const NAME_LIMIT = 4;

export function ChangeFeed({
  changes,
  now,
  title,
  id,
  kinds,
  emptyTitle,
  emptyBody,
  limit,
}: {
  changes: ChangeWithProvider[];
  now: number;
  title: string;
  id?: string;
  kinds?: string[];
  emptyTitle: string;
  emptyBody: string;
  /**
   * Caps how many provider groups this feed renders. The landing page caps
   * it, because an uncapped feed is the same length as the change log and
   * reproduces /timeline inside the home page (APR-055). The cap is a row
   * count on groups, not on changes, so a reader sees whole subjects.
   *
   * Capping never removes access: the Full timeline link above is always
   * rendered, whichever routes the landing page passes.
   */
  limit?: number;
}) {
  const rows = kinds
    ? changes.filter((c) => kinds.includes(c.change_type))
    : changes;

  const allGroups = groupChanges(rows);
  const groups = limit ? allGroups.slice(0, limit) : allGroups;
  const hidden = allGroups.length - groups.length;

  return (
    <section id={id} className="sect">
      <div className="sect-head">
        <h2 className="sect-title">{title}</h2>
        <Link href="/timeline" className="link-ev">
          Full timeline
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      {groups.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
      ) : (
        <>
          <ol className="feed">
            {groups.map((g) => (
              <GroupRow key={g.key} group={g} now={now} />
            ))}
          </ol>
          {hidden > 0 ? (
            <p className="annot" style={{ marginTop: "0.75rem" }}>
              Showing {groups.length} of {allGroups.length} subjects with
              recorded changes in the last 6 hours. {hidden} more are on the
              full timeline.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function GroupRow({ group, now }: { group: Group; now: number }) {
  const { provider, rows, first } = group;
  const count = rows.length;
  const named = rows.slice(0, NAME_LIMIT);
  const rest = count - named.length;

  return (
    <li className="panel feed-row">
      <div className="feed-when">
        <p className="mono feed-stamp">{stampUTC(first.detected_at)}</p>
        <p className="annot mono">{ago(first.detected_at, now)}</p>
      </div>

      <div className="feed-what">
        <div className="feed-subject-head">
          {provider ? (
            <Link href={`/providers/${provider.slug}`} className="link">
              {provider.name}
            </Link>
          ) : (
            <span className="strong">Unattributed</span>
          )}
          {count > 1 ? (
            <span className="badge badge-info">
              {count} route{count === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <p className="label" style={{ color: "var(--t-upcoming)" }}>
          {CHANGE_LABEL[group.changeType] ?? group.changeType}
        </p>

        {/* The subject of each change, named. Without this, several genuinely
            different discoveries read as identical lines. */}
        <ul className="feed-subjects">
          {named.map((c) => (
            <li key={c.id} className="feed-subject">
              {c.offer ? (
                c.offer_id ? (
                  <Link href={`/evidence/${c.offer_id}`} className="mono">
                    {c.offer.model_label}
                  </Link>
                ) : (
                  <span className="mono">{c.offer.model_label}</span>
                )
              ) : (
                <span className="mono">
                  {FIELD_LABEL[c.field ?? ""] ?? c.field ?? "Event"}
                </span>
              )}
              {c.change_type === "new" ? (
                <span className="annot">
                  added as {c.new_value?.replace(/_/g, " ")}
                </span>
              ) : c.field ? (
                <span className="annot">
                  {FIELD_LABEL[c.field] ?? c.field}:{" "}
                  <span className="mono">{readable(c.old_value)}</span>
                  {" → "}
                  <span className="mono strong">{readable(c.new_value)}</span>
                </span>
              ) : null}
            </li>
          ))}
          {rest > 0 ? (
            <li className="annot feed-subject">
              and {rest} more route{rest === 1 ? "" : "s"} at this provider
            </li>
          ) : null}
        </ul>

        {first.evidence ? <p className="annot">{first.evidence}</p> : null}
      </div>

      <div className="feed-source">
        {first.offer_id ? (
          <EvidenceLink offerId={first.offer_id} />
        ) : first.source_url ? (
          <a
            href={first.source_url}
            className="link-ev"
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            Source <span aria-hidden="true">→</span>
          </a>
        ) : null}
      </div>
    </li>
  );
}

const readable = (v: string | null) => {
  if (v === null || v === "") return "not stated";
  if (v === "true") return "yes";
  if (v === "false") return "no";
  return v;
};

/**
 * The ended archive (§24, §16).
 *
 * Mandatory, and never pruned. A free tier that was withdrawn two years ago is
 * still the answer to "does this provider have a free tier", and deleting it
 * would make the site less accurate over time rather than more.
 */
export function EndedArchive({
  offers,
  now,
}: {
  offers: OfferWithProvider[];
  now: number;
}) {
  return (
    <section id="ended" className="sect">
      <div className="sect-head">
        <h2 className="sect-title">Ended</h2>
        <p className="sect-note">
          Withdrawn free access, kept permanently. A provider that dropped its
          free tier is a fact worth knowing, and it stays here for good.
        </p>
      </div>

      {offers.length === 0 ? (
        <EmptyState title="No ended offers">
          Nothing we track has withdrawn its free access yet.
        </EmptyState>
      ) : (
        <ul className="ended-list">
          {offers.map((o) => (
            <li key={o.id} className="panel ended-row">
              <div className="ended-head">
                <h3 className="ended-provider">
                  {o.provider ? (
                    <Link href={`/providers/${o.provider.slug}`} className="link">
                      {o.provider.name}
                    </Link>
                  ) : (
                    "Unknown provider"
                  )}
                </h3>
                <p className="mono ended-date">{stampUTC(o.ended_at)}</p>
              </div>
              <p className="ended-offer mono">{o.model_label}</p>
              {o.exhaustion_condition ? (
                <p className="annot">Reason: {o.exhaustion_condition}</p>
              ) : null}
              <div style={{ marginTop: "0.5rem" }}>
                <EvidenceLink offerId={o.id} />
              </div>
              {o.last_verified_at ? (
                <p className="annot mono" style={{ marginTop: "0.5rem" }}>
                  Last verified {ago(o.last_verified_at, now)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Source health (§13, §50).
 *
 * The distinction this section exists to make: a source that is down is not an
 * offer that ended. Without it, an outage would silently look like a
 * withdrawal, which is the single worst failure this product could have.
 */
export function SourceHealthPanel({
  sourcesOk,
  sourcesTotal,
  lastSweep,
  nextSweep,
  unhealthy,
}: {
  sourcesOk: number;
  sourcesTotal: number;
  lastSweep: string | null;
  nextSweep: string | null;
  unhealthy: number;
}) {
  return (
    <div className="panel health">
      <div className="health-row">
        <div>
          <p className="label">Sources responding</p>
          <p className="mono health-figure">
            {sourcesOk} / {sourcesTotal}
          </p>
        </div>
        <div>
          <p className="label">Last sweep</p>
          <p className="mono health-figure">
            {stampUTC(lastSweep) ?? "Not yet run"}
          </p>
        </div>
        <div>
          <p className="label">Next sweep</p>
          <p className="mono health-figure">
            {stampUTC(nextSweep) ?? "Not scheduled"}
          </p>
        </div>
        <div>
          <p className="label">Impaired</p>
          <p
            className="mono health-figure"
            style={{ color: unhealthy ? "var(--t-upcoming)" : "var(--t-live)" }}
          >
            {unhealthy}
          </p>
        </div>
      </div>

      {unhealthy > 0 ? (
        <p className="annot" style={{ marginTop: "1rem" }}>
          A source that is not responding does <strong>not</strong> mean its
          offers ended. Those offers keep their last verified values and are
          marked stale as their verification ages.
        </p>
      ) : null}
    </div>
  );
}
