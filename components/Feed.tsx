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

/**
 * Collapse change rows into one visual entry per distinct change.
 *
 * Two change rows exist for a single observed difference: the sweep records
 * the same `pool remaining: 25 -> 22` against the offer and against the event,
 * with an identical timestamp (observed as ids 351 and 352). Merging happens
 * because groupChanges groups by provider, type and moment - and then each row
 * was rendered as its own subject, so the same value change appeared twice.
 *
 * Deduplication is by the difference a reader sees - field, old, new - not by
 * the subject name. Only one of the two rows carries an offer, so only one of
 * them has a subject to name: keying on the subject kept both, which is how
 * the same change printed twice. Distinct offers that moved the same field to
 * the same values stay distinct, because an offer row is keyed by its own
 * offer id. Nothing is dropped that a reader could tell apart, and no stored
 * row is altered - this is a rendering rule, not a rewrite of history.
 *
 * The field label is only repeated in the detail when the subject is an offer
 * name. When there is no offer the subject *is* the field, so repeating it
 * produced "event statusevent status".
 */
interface Entry {
  key: string;
  label: string;
  offerId: number | null;
  added: string | null;
  showField: string | null;
  oldValue: string | null;
  newValue: string | null;
}

function collapse(rows: ChangeWithProvider[]): Entry[] {
  // The difference a reader can see, independent of which row carries it.
  const difference = (c: ChangeWithProvider) =>
    [c.field ?? "", c.old_value ?? "", c.new_value ?? ""].join("|");

  // Every difference that an offer-bearing row already states. The event row
  // for the same difference adds no fact, only a second rendering of it.
  const statedByOffer = new Set<string>();
  for (const c of rows) {
    if (c.offer) statedByOffer.add(difference(c));
  }

  const seen = new Map<string, Entry>();
  const order: string[] = [];

  for (const c of rows) {
    const hasOffer = Boolean(c.offer);
    const diff = difference(c);

    // The event half of a difference an offer row already states.
    if (!hasOffer && statedByOffer.has(diff)) continue;
    // A row with nothing to say renders an empty subject line.
    if (!hasOffer && !c.field && c.new_value === null) continue;

    const field = c.field ? (FIELD_LABEL[c.field] ?? c.field) : null;
    const label = hasOffer
      ? (c.offer?.model_label ?? "")
      : (field ?? c.field ?? "Event");

    const added =
      c.change_type === "new" ? (c.new_value?.replace(/_/g, " ") ?? "") : null;

    const e: Entry = {
      key: `${hasOffer ? `offer:${c.offer_id}` : "event"}|${diff}`,
      label,
      offerId: hasOffer && c.offer_id ? c.offer_id : null,
      added,
      showField: hasOffer ? field : null,
      oldValue: c.field ? readable(c.old_value) : null,
      newValue: c.field ? readable(c.new_value) : null,
    };
    if (!seen.has(e.key)) {
      seen.set(e.key, e);
      order.push(e.key);
    }
  }
  return order.map((k) => seen.get(k)!);
}

function GroupRow({ group, now }: { group: Group; now: number }) {
  const { provider, rows, first } = group;
  const entries = collapse(rows);
  const count = entries.length;
  const named = entries.slice(0, NAME_LIMIT);
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
              {count} changes
            </span>
          ) : null}
        </div>

        <p className="label" style={{ color: "var(--t-upcoming)" }}>
          {CHANGE_LABEL[group.changeType] ?? group.changeType}
        </p>

        {/* The subject of each change, named. Without this, several genuinely
            different discoveries read as identical lines. */}
        <ul className="feed-subjects">
          {named.map((e) => (
            <li key={e.key} className="feed-subject">
              {e.offerId ? (
                <Link href={`/evidence/${e.offerId}`} className="mono">
                  {e.label}
                </Link>
              ) : (
                <span className="mono">{e.label}</span>
              )}
              {e.added !== null ? (
                <span className="annot">added as {e.added}</span>
              ) : e.oldValue !== null ? (
                <span className="annot">
                  {e.showField ? `${e.showField}: ` : null}
                  <span className="mono">{e.oldValue}</span>
                  {" → "}
                  <span className="mono strong">{e.newValue}</span>
                </span>
              ) : null}
            </li>
          ))}
          {rest > 0 ? (
            <li className="annot feed-subject">
              and {rest} more change{rest === 1 ? "" : "s"} at this provider
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
/**
 * One intelligence band with two columns: New and Changed.
 *
 * The brief wants New and Changed as a single two-column band rather than two
 * stacked sections, with three subjects shown in each column. This keeps the
 * "what is new vs what changed" comparison side by side and stops the page
 * from reading as two near-identical lists.
 *
 * Each column is capped at three groups, because uncapped would reproduce
 * /timeline inside the home page (APR-055). The full timeline stays one link
 * away.
 */
export function IntelliFeed({
  changes,
  now,
}: {
  changes: ChangeWithProvider[];
  now: number;
}) {
  const newRows = changes.filter((c) => c.change_type === "new");
  const changedRows = changes.filter(
    (c) => c.change_type !== "new",
  );

  const newGroups = groupChanges(newRows).slice(0, 3);
  const changedGroups = groupChanges(changedRows).slice(0, 3);

  const newHidden = groupChanges(newRows).length - newGroups.length;
  const changedHidden = groupChanges(changedRows).length - changedGroups.length;

  return (
    <section id="intel" className="sect intel-band">
      <div className="sect-head">
        <h2 className="sect-title">New and changed</h2>
        <Link href="/timeline" className="link-ev">
          Full timeline
          <span aria-hidden="true"> →</span>
        </Link>
      </div>
      <div className="intel-grid">
        <div className="intel-col">
          <p className="label" style={{ color: "var(--t-live)" }}>
            New
          </p>
          {newGroups.length === 0 ? (
            <p className="annot">Nothing new this cycle.</p>
          ) : (
            <ol className="feed">
              {newGroups.map((g) => (
                <GroupRow key={g.key} group={g} now={now} />
              ))}
            </ol>
          )}
          {newHidden > 0 ? (
            <p className="annot" style={{ marginTop: "0.5rem" }}>
              {newHidden} more new{" "}
              {newHidden === 1 ? "subject" : "subjects"} on the full timeline.
            </p>
          ) : null}
        </div>

        <div className="intel-col">
          <p className="label" style={{ color: "var(--t-upcoming)" }}>
            Changed
          </p>
          {changedGroups.length === 0 ? (
            <p className="annot">No tracked changes since the last sweep.</p>
          ) : (
            <ol className="feed">
              {changedGroups.map((g) => (
                <GroupRow key={g.key} group={g} now={now} />
              ))}
            </ol>
          )}
          {changedHidden > 0 ? (
            <p className="annot" style={{ marginTop: "0.5rem" }}>
              {changedHidden} more changed{" "}
              {changedHidden === 1 ? "subject" : "subjects"} on the full timeline.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

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
                {/* The title carries the provider AND the access type so the row
                    still reads standalone when skimmed out of order - "Free
                    tier" on its own tells a reader nothing about whose. */}
                <h3 className="ended-provider">
                  {o.provider ? (
                    <Link href={`/providers/${o.provider.slug}`} className="link">
                      {o.provider.name}
                    </Link>
                  ) : (
                    "Unknown provider"
                  )}
                  <span className="ended-type">
                    {OFFER_TYPE_LABEL[o.offer_type]}
                  </span>
                </h3>
                <p className="mono ended-date">{stampUTC(o.ended_at)}</p>
              </div>
              <p className="ended-offer mono">{o.model_label}</p>
              <p className="ended-plain">
                No longer offered as free access.
              </p>
              {/* Stored reason kept verbatim, one click away. Several reasons
                  quote internal repair notes verbatim, which reads as a system
                  error to anyone outside the project. Displaying it unchanged
                  matters more than tidying it, so it moves behind a
                  disclosure instead of being rewritten. */}
              {o.exhaustion_condition ? (
                <details className="tech-note">
                  <summary className="annot">Technical note</summary>
                  <p className="annot mono tech-note-body">
                    {o.exhaustion_condition}
                  </p>
                </details>
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
  const allOk = sourcesTotal > 0 && unhealthy === 0;
  return (
    <div className="status-bar" role="status" aria-label="Radar status">
      <div className="status-cell">
        {/* State is never colour alone: the dot is paired with a word. */}
        <span
          className={`dot ${allOk ? "dot-live" : "dot-upcoming"}`}
          aria-hidden="true"
        />
        <span className="label">Sources</span>
        <span className="mono status-figure">
          {sourcesOk} / {sourcesTotal}
        </span>
        {!allOk ? (
          <span className="annot status-flag">{unhealthy} impaired</span>
        ) : null}
      </div>

      <div className="status-cell">
        <span className="label">Last sweep</span>
        <span className="mono status-figure">
          {stampUTC(lastSweep) ?? "Not yet run"}
        </span>
      </div>

      <div className="status-cell">
        <span className="label">Next</span>
        <span className="mono status-figure">
          {stampUTC(nextSweep) ?? "Not scheduled"}
        </span>
      </div>

      {unhealthy > 0 ? (
        <p className="annot status-note">
          An impaired source is <strong>not</strong> an ended offer. Its offers
          keep their last verified values and age to stale; nothing is marked
          ended because a fetch failed.
        </p>
      ) : null}
    </div>
  );
}