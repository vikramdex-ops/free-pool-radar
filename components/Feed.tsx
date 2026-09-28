import Link from "next/link";
import type { Change, ChangeWithProvider, OfferWithProvider } from "@/lib/db";
import { ago, stampUTC } from "@/lib/format";
import { ChangeHeadline, EmptyState, EvidenceLink } from "./ui";

/**
 * What is new and what changed (§22, §23).
 *
 * Derived from the change log rather than assembled from current state, which
 * is what makes the history honest: an entry exists because a difference was
 * detected between two observations, not because today's value looks notable.
 */
export function ChangeFeed({
  changes,
  now,
  title,
  id,
  kinds,
  emptyTitle,
  emptyBody,
}: {
  changes: ChangeWithProvider[];
  now: number;
  title: string;
  id?: string;
  /** Restrict to these change types, e.g. discoveries only. */
  kinds?: string[];
  emptyTitle: string;
  emptyBody: string;
}) {
  const rows = kinds ? changes.filter((c) => kinds.includes(c.change_type)) : changes;

  return (
    <section id={id} className="sect">
      <div className="sect-head">
        <h2 className="sect-title">{title}</h2>
        <Link href="/timeline" className="link-ev">
          Full timeline
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
      ) : (
        <ol className="feed">
          {rows.map((c) => (
            <li key={c.id} className="panel feed-row">
              <div className="feed-when">
                <p className="mono feed-stamp">{stampUTC(c.detected_at)}</p>
                <p className="annot mono">{ago(c.detected_at, now)}</p>
              </div>
              <div className="feed-what">
                {c.provider ? (
                  <Link href={`/providers/${c.provider.slug}`} className="link">
                    {c.provider.name}
                  </Link>
                ) : (
                  <span className="strong">Unattributed</span>
                )}
                <ChangeHeadline
                  type={c.change_type}
                  field={c.field}
                  oldValue={c.old_value}
                  newValue={c.new_value}
                />
                {c.evidence ? <p className="annot">{c.evidence}</p> : null}
              </div>
              <div className="feed-source">
                <EvidenceLink href={c.source_url} kind="Evidence" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

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
                <EvidenceLink href={o.official_evidence_url} />
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
          <p className="mono health-figure">{stampUTC(lastSweep) ?? "Not yet run"}</p>
        </div>
        <div>
          <p className="label">Next sweep</p>
          <p className="mono health-figure">{stampUTC(nextSweep) ?? "Not scheduled"}</p>
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

export type { Change };
