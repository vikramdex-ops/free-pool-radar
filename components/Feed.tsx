import Link from "next/link";
import type { ChangeWithProvider, OfferWithProvider } from "@/lib/db";
import {
  CHANGE_LABEL,
  FIELD_LABEL,
  OFFER_TYPE_LABEL,
  ago,
  stampUTC,
} from "@/lib/format";
import { EmptyState, EvidenceLink } from "./ui";
import { ScrollAnimation, StaggerContainer } from "./Cinematic";

/**
 * What is new and what changed (§22, §23) - Enhanced with scroll animations.
 */

interface Group {
  key: string;
  provider: ChangeWithProvider["provider"];
  changeType: string;
  rows: ChangeWithProvider[];
  first: ChangeWithProvider;
}

function groupChanges(
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
  limit?: number;
}) {
  const rows = kinds
    ? changes.filter((c) => kinds.includes(c.change_type))
    : changes;

  const allGroups = groupChanges(rows);
  const groups = limit ? allGroups.slice(0, limit) : allGroups;
  const hidden = allGroups.length - groups.length;

  return (
    <ScrollAnimation>
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
            <StaggerContainer className="feed">
              {groups.map((g) => (
                <GroupRow key={g.key} group={g} now={now} />
              ))}
            </StaggerContainer>
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
    </ScrollAnimation>
  );
}

function GroupRow({ group, now }: { group: Group; now: number }) {
  const { provider, changeType, rows, first } = group;
  const label = CHANGE_LABEL[changeType as keyof typeof CHANGE_LABEL] ?? changeType;
  
  const named = rows.slice(0, NAME_LIMIT);
  const overflow = rows.length - NAME_LIMIT;

  return (
    <li className="feed-item stagger-item">
      <div className="panel panel-enhanced feed-card">
        <div className="feed-head">
          <span className="label">{provider?.name ?? "Unknown"}</span>
          <span className="badge badge-upcoming">{label}</span>
        </div>

        <p className="feed-summary">
          {ago(first.detected_at, now)}
        </p>

        <ul className="feed-subjects">
          {named.map((c) => (
            <li key={c.id} className="mono">
              {c.field_name ? `${FIELD_LABEL[c.field_name as keyof typeof FIELD_LABEL] ?? c.field_name}: ` : ""}
              {c.old_value && c.old_value !== "not_stated" ? (
                <span className="faded">{c.old_value} → </span>
              ) : null}
              {c.new_value}
            </li>
          ))}
        </ul>

        {overflow > 0 ? (
          <p className="annot">+ {overflow} more</p>
        ) : null}

        <div className="feed-foot">
          <EvidenceLink
            url={first.source_url}
            verifiedAt={first.detected_at}
          />
        </div>
      </div>
    </li>
  );
}

export function IntelliFeed({
  offers,
  now,
  limit = 8,
}: {
  offers: OfferWithProvider[];
  now: number;
  limit?: number;
}) {
  const live = offers
    .filter((o) => o.status === "live")
    .sort((a, b) => 
      new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime()
    )
    .slice(0, limit);

  return (
    <ScrollAnimation>
      <section className="sect">
        <div className="sect-head">
          <h2 className="sect-title">Recently Verified</h2>
          <Link href="/live" className="link-ev">
            All live routes
            <span aria-hidden="true"> →</span>
          </Link>
        </div>

        <StaggerContainer className="feed">
          {live.map((o) => (
            <li key={o.id} className="feed-item stagger-item">
              <div className="panel panel-enhanced feed-card">
                <div className="feed-head">
                  <span className="label">{o.provider?.name ?? "Unknown"}</span>
                  <span className="badge badge-live">
                    <span className="dot" aria-hidden="true" />
                    LIVE
                  </span>
                </div>
                <h3 className="mono">{o.model_label}</h3>
                <p className="annot">Verified {ago(o.verified_at, now)}</p>
              </div>
            </li>
          ))}
        </StaggerContainer>
      </section>
    </ScrollAnimation>
  );
}

export function EndedArchive({
  ended,
  limit = 6,
}: {
  ended: OfferWithProvider[];
  limit?: number;
}) {
  const recent = ended.slice(0, limit);

  return (
    <ScrollAnimation>
      <section className="sect">
        <div className="sect-head">
          <h2 className="sect-title">Recently Ended</h2>
          <Link href="/timeline?filter=ended" className="link-ev">
            View archive
            <span aria-hidden="true"> →</span>
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState title="No ended offers">
            Nothing has been withdrawn or exhausted in the recent history.
          </EmptyState>
        ) : (
          <StaggerContainer className="feed">
            {recent.map((o) => (
              <li key={o.id} className="feed-item stagger-item">
                <div className="panel panel-enhanced feed-card">
                  <div className="feed-head">
                    <span className="label">{o.provider?.name ?? "Unknown"}</span>
                    <span className="badge" style={{ 
                      background: "rgba(255, 112, 112, 0.1)",
                      borderColor: "var(--t-ended)",
                      color: "var(--t-ended)"
                    }}>
                      ENDED
                    </span>
                  </div>
                  <h3 className="mono">{o.model_label}</h3>
                  {o.ended_at ? (
                    <p className="annot">Ended {stampUTC(o.ended_at)}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </StaggerContainer>
        )}
      </section>
    </ScrollAnimation>
  );
}

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
  const health = sourcesTotal > 0 ? (sourcesOk / sourcesTotal) * 100 : 0;

  return (
    <ScrollAnimation>
      <div className="panel panel-enhanced stat-card-3d" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 className="label">System Status</h3>
          <span className={`badge ${health >= 90 ? "badge-live" : "badge-upcoming"}`}>
            {health >= 90 ? "Operational" : "Degraded"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1.5rem" }}>
          <div>
            <p className="label">Sources Online</p>
            <p className="mono" style={{ fontSize: "1.75rem", fontWeight: 600, color: "var(--t-live)" }}>
              {sourcesOk} / {sourcesTotal}
            </p>
          </div>

          {lastSweep ? (
            <div>
              <p className="label">Last Sweep</p>
              <p className="mono" style={{ fontSize: "0.875rem" }}>
                {stampUTC(lastSweep)}
              </p>
            </div>
          ) : null}

          {nextSweep ? (
            <div>
              <p className="label">Next Sweep</p>
              <p className="mono" style={{ fontSize: "0.875rem" }}>
                {stampUTC(nextSweep)}
              </p>
            </div>
          ) : null}
        </div>

        {unhealthy > 0 ? (
          <p className="annot" style={{ marginTop: "1rem", color: "var(--t-upcoming)" }}>
            ⚠ {unhealthy} {unhealthy === 1 ? "source" : "sources"} not responding
          </p>
        ) : null}
      </div>
    </ScrollAnimation>
  );
}
