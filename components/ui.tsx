import type { ReactNode } from "react";
import Link from "next/link";
import type {
  Freshness,
  OfferStatus,
  OfferType,
  VerificationLevel,
} from "@/lib/db";
import {
  CHANGE_LABEL,
  FIELD_LABEL,
  FRESHNESS_LABEL,
  OFFER_TYPE_LABEL,
  STATUS_LABEL,
  VERIFICATION_LABEL,
} from "@/lib/format";

/* ------------------------------------------------------------------ */
/* status                                                              */
/* ------------------------------------------------------------------ */

/** The single visual vocabulary for status colour, so §5 is never violated. */
const STATUS_CLASS: Record<OfferStatus, string> = {
  live: "badge-live",
  changed: "badge-upcoming",
  upcoming: "badge-upcoming",
  ending: "badge-upcoming",
  exhausted: "badge-ended",
  ended: "badge-ended",
  suspended: "badge-ended",
  unverified: "badge-stale",
};

export function StatusBadge({
  status,
  solid = false,
}: {
  status: OfferStatus;
  solid?: boolean;
}) {
  return (
    <span
      className={`badge ${solid ? "badge-solid" : STATUS_CLASS[status]}`}
      style={
        solid
          ? { background: `var(--t-${status === "live" ? "live" : status === "ended" || status === "exhausted" || status === "suspended" ? "ended" : status === "unverified" ? "stale" : "upcoming"})` }
          : undefined
      }
    >
      <span className="dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Access type. Kept distinct from status: one says what it is, the other
 *  says whether it works. Collapsing them is exactly the mistake §5 forbids. */
export function TypeBadge({ type }: { type: OfferType }) {
  return <span className="chip">{OFFER_TYPE_LABEL[type]}</span>;
}

/* ------------------------------------------------------------------ */
/* verification                                                        */
/* ------------------------------------------------------------------ */

const VERIFICATION_CLASS: Record<VerificationLevel, string> = {
  live_api: "badge-live",
  official_docs: "badge-info",
  official_event_page: "badge-info",
  official_announcement: "badge-info",
  official_social: "badge-info",
  secondary: "badge-stale",
  community: "badge-stale",
};

export function VerificationBadge({ level }: { level: VerificationLevel }) {
  return (
    <span className={`badge ${VERIFICATION_CLASS[level]}`}>
      {VERIFICATION_LABEL[level]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* freshness (§14)                                                     */
/* ------------------------------------------------------------------ */

const FRESHNESS_CLASS: Record<Freshness, string> = {
  fresh: "badge-live",
  aging: "badge-info",
  stale: "badge-stale",
  very_stale: "badge-ended",
  unverified: "badge-stale",
};

export function FreshnessIndicator({
  freshness,
  ago,
}: {
  freshness: Freshness;
  ago: string | null;
}) {
  return (
    <span className="fresh">
      <span className={`badge ${FRESHNESS_CLASS[freshness]}`}>
        {FRESHNESS_LABEL[freshness]}
      </span>
      {ago ? <span className="annot mono">{ago}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* conditions                                                          */
/* ------------------------------------------------------------------ */

/** Yes/no for a hard condition, phrased so it reads without the column
 *  header. Never inferred: the caller passes the stored boolean. */
export function Condition({
  ok,
  when,
  otherwise,
}: {
  ok: boolean;
  when: string;
  otherwise: string;
}) {
  return (
    <span className={`chip ${ok ? "chip-yes" : "chip-no"}`}>
      <span className="dot" aria-hidden="true" />
      {ok ? when : otherwise}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* pool capacity (§72)                                                 */
/* ------------------------------------------------------------------ */

/**
 * A pool's remaining capacity as a filled bar.
 *
 * The percentage is only ever drawn from stored figures. When either side of
 * the ratio is unknown the bar renders empty with the numbers beside it,
 * rather than implying a full or empty pool that nobody published.
 */
export function PoolMeter({
  remaining,
  size,
  unit,
  pct,
}: {
  remaining: string;
  size: string;
  unit: string;
  /** 0–100, or null when the ratio cannot be computed. */
  pct: number | null;
}) {
  const known = pct !== null;
  const width = known ? Math.max(0, Math.min(100, pct)) : 0;
  const cls = !known ? "" : width <= 0 ? "bar-fill-spent" : width < 15 ? "bar-fill-low" : "";
  return (
    <div>
      <div
        className="bar"
        role="img"
        aria-label={
          known
            ? `Pool ${unit}: ${remaining} remaining of ${size}`
            : `Pool ${unit}: remaining ${remaining} of ${size}`
        }
      >
        <div className={`bar-fill ${cls}`} style={{ width: `${width}%` }} />
      </div>
      <p className="annot mono" style={{ marginTop: "0.375rem" }}>
        {remaining} of {size} {unit} remaining
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* countdown                                                           */
/* ------------------------------------------------------------------ */

export function Countdown({
  days,
  hours,
  minutes,
}: {
  days: number;
  hours: number;
  minutes: number;
}) {
  const cells = [
    { v: days, u: "D" },
    { v: hours, u: "H" },
    { v: minutes, u: "M" },
  ];
  return (
    <div className="flex items-baseline gap-2" aria-label={`${days} days ${hours} hours ${minutes} minutes`}>
      {cells.map((c, i) => (
        <span key={c.u} className="inline-flex items-baseline gap-2">
          {i > 0 ? (
            <span className="mono" style={{ color: "var(--t-ink-3)" }}>
              :
            </span>
          ) : null}
          <span className="mono" style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            {String(c.v).padStart(2, "0")}
          </span>
          <span className="label">{c.u}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* evidence (§60)                                                      */
/* ------------------------------------------------------------------ */

/**
 * A link to the evidence page for an offer, not to the source URL.
 *
 * Many source URLs are machine endpoints, and sending a reader to a raw JSON
 * catalogue to confirm one rate limit is not evidence — it is a chore with no
 * way to tell which field matters. The evidence page states the claim, shows the
 * extracted figure with its provenance, and offers the raw URL last.
 *
 * `href` remains for the places that genuinely want the source: provider
 * homepages and provider/event pages, where there is no single claim to show.
 */
export function EvidenceLink({
  offerId,
  href,
  kind = "Evidence",
}: {
  offerId?: number;
  href?: string | null;
  kind?: string;
}) {
  if (offerId !== undefined) {
    return (
      <Link href={`/evidence/${offerId}`} className="link-ev">
        {kind} <span aria-hidden="true">→</span>
      </Link>
    );
  }
  if (!href) {
    return <span className="annot">No source published</span>;
  }
  return (
    <a
      href={href}
      className="link-ev"
      target="_blank"
      rel="noopener noreferrer nofollow"
    >
      {kind} <span aria-hidden="true">→</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* change                                                              */
/* ------------------------------------------------------------------ */

export function ChangeHeadline({
  type,
  field,
  oldValue,
  newValue,
}: {
  type: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
}) {
  const readable = (v: string | null) => {
    if (v === null || v === "") return "not stated";
    if (v === "true") return "yes";
    if (v === "false") return "no";
    return v;
  };
  return (
    <div>
      <p
        className="label"
        style={{ color: "var(--t-upcoming)" }}
      >
        {CHANGE_LABEL[type] ?? type}
      </p>
      {field ? (
        <p className="annot strong" style={{ marginTop: "0.25rem" }}>
          {FIELD_LABEL[field] ?? field}:{" "}
          <span className="mono">{readable(oldValue)}</span>
          <span aria-hidden="true" style={{ color: "var(--t-ink-3)" }}>
            {" → "}
          </span>
          <span className="mono" style={{ color: "var(--t-ink)" }}>
            {readable(newValue)}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

export function Section({
  id,
  title,
  note,
  action,
  children,
}: {
  id?: string;
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="sect">
      <div className="sect-head">
        <h2 className="sect-title">{title}</h2>
        {action ? <div>{action}</div> : null}
      </div>
      {note ? (
        <p className="sect-note" style={{ marginBottom: "1.5rem" }}>
          {note}
        </p>
      ) : null}
      {children}
    </section>
  );
}

/** The §65 empty state. Never a fabricated row to fill the gap. */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <div className="annot">{children}</div> : null}
    </div>
  );
}
