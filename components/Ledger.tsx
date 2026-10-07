import Link from "next/link";
import type { OfferWithProvider } from "@/lib/db";
import {
  NOT_STATED,
  ago,
  freshness,
  num,
  pool,
  quota,
  stampUTC,
  unitLabel,
} from "@/lib/format";
import {
  Condition,
  EmptyState,
  EvidenceLink,
  FreshnessIndicator,
  PoolMeter,
  StatusBadge,
  TypeBadge,
  VerificationBadge,
} from "./ui";

/**
 * The live ledger (§21).
 *
 * One row per free route currently usable. Every column is a stored fact. Where
 * a provider publishes nothing, the cell says so rather than showing a zero or
 * a dash that a reader might mistake for a real limit.
 *
 * `limit` caps what a single page renders. The landing page caps it because a
 * full table of every free route runs to several thousand pixels, which buries
 * the rest of the page; the cap is stated in the caption so the reader knows
 * more exists, and /live holds the complete set.
 *
 * The table becomes cards below 900px rather than scrolling sideways, because a
 * horizontally scrolling table on a phone hides exactly the columns that
 * matter (§42).
 */
export function OfferLedger({
  offers,
  now,
  showProvider = true,
  limit,
}: {
  offers: OfferWithProvider[];
  now: number;
  showProvider?: boolean;
  limit?: number;
}) {
  if (offers.length === 0) {
    return (
      <EmptyState title="No verified offers">
        We haven&rsquo;t found a currently verified offer matching these
        filters. Offers appear here only after a source reports them and the
        figures below can be traced to it.
      </EmptyState>
    );
  }

  const shown = limit ? offers.slice(0, limit) : offers;
  const hidden = offers.length - shown.length;

  // APR-005: the cards are the narrow form of this ledger (the table hides
  // below 900px), so they render the full shown set with no separate cap. A
  // hard 6 here once meant a narrow reader saw 6 cards under counts claiming
  // every route. Rendered and counted are the same array, so they cannot
  // disagree.
  const cards = shown.map((o) => <OfferCard key={o.id} offer={o} now={now} />);

  return (
    <div className="ledger">
      <div className="ledger-cards">
        {cards}
      </div>

      <div className="tbl-wrap ledger-table">
        <table className="tbl tbl-live">
          <caption>
            {hidden > 0
              ? `Showing ${shown.length} of ${offers.length} currently usable free routes`
              : `${offers.length} currently usable free route${offers.length === 1 ? "" : "s"}`}
          </caption>
          <thead>
            <tr>
              {showProvider ? (
                <th scope="col" className="sticky-col">
                  Provider
                </th>
              ) : null}
              <th scope="col">Model or route</th>
              <th scope="col">Access</th>
              {/* Card, subscription and key are one decision to make, not three
                  separate facts to compare. Merging them takes the table from
                  eleven columns to eight, which is the difference between
                  reading it and dragging it sideways. */}
              <th scope="col">Requirements</th>
              <th scope="col">Pool or quota</th>
              <th scope="col">Compatible</th>
              <th scope="col">Last verified</th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => {
              const p = pool(o);
              return (
                <tr key={o.id}>
                  {showProvider ? (
                    <td className="sticky-col">
                      {o.provider ? (
                        <Link
                          href={`/providers/${o.provider.slug}`}
                          className="link key"
                        >
                          {o.provider.name}
                        </Link>
                      ) : (
                        <span className="key">Unknown</span>
                      )}
                    </td>
                  ) : null}
                  <td className="cell-model">
                    <span className="key mono" title={o.model_label}>
                      {o.model_label}
                    </span>
                    {o.status === "upcoming" ? (
                      <span className="cell-tag">Upcoming</span>
                    ) : null}
                  </td>
                  <td>
                    <TypeBadge type={o.offer_type} />
                  </td>
                  <td>
                    <Requirements offer={o} />
                  </td>
                  <td className="num">
                    {p
                      ? `${num(o.pool_remaining)} ${unitLabel(o.pool_unit)}`
                      : (quota(o) ?? NOT_STATED)}
                  </td>
                  <td>
                    <span className="compat">
                      {o.compatibility_openai ? (
                        <span className="chip">OpenAI</span>
                      ) : null}
                      {o.compatibility_anthropic ? (
                        <span className="chip">Anthropic</span>
                      ) : null}
                      {!o.compatibility_openai && !o.compatibility_anthropic ? (
                        <span className="annot">{NOT_STATED}</span>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <FreshnessIndicator
                      freshness={freshness(o.last_verified_at, now)}
                      ago={ago(o.last_verified_at, now)}
                    />
                  </td>
                  <td>
                    <EvidenceLink offerId={o.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hidden > 0 ? (
        <p className="annot" style={{ marginTop: "1rem" }}>
          {num(hidden)} further free route{hidden === 1 ? "" : "s"} not shown
          here.{" "}
          <Link href="/live" className="link">
            See all {offers.length}
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

/**
 * Card, subscription and key in one cell.
 *
 * These were three separate columns, which read as three separate facts when
 * they are one decision: can I actually use this without paying or signing up?
 * The only combinations worth drawing attention to are the ones that cost the
 * reader something, so those are marked and the common case is stated once.
 */
function Requirements({ offer }: { offer: OfferWithProvider }) {
  const blockers: string[] = [];
  if (offer.card_required) blockers.push("card");
  if (offer.access_requires_subscription) blockers.push("subscription");
  if (offer.payment_required && !offer.card_required) blockers.push("payment");

  return (
    <div className="req">
      {blockers.length > 0 ? (
        <span className="chip chip-no">
          <span className="dot" aria-hidden="true" />
          {blockers.join(" + ")} required
        </span>
      ) : (
        <span className="chip chip-yes">
          <span className="dot" aria-hidden="true" />
          No card, no sub
        </span>
      )}
      {offer.keyless ? (
        <span className="chip chip-yes">Keyless</span>
      ) : (
        <span className="chip">Key required</span>
      )}
    </div>
  );
}

/** The card form used on narrow viewports, and the only form below 900px. */
function OfferCard({ offer, now }: { offer: OfferWithProvider; now: number }) {
  const p = pool(offer);
  const q = quota(offer);
  const verified = ago(offer.last_verified_at, now);

  return (
    <article className="panel offer-card">
      <div className="offer-card-head">
        <div>
          {offer.provider ? (
            <Link href={`/providers/${offer.provider.slug}`} className="link">
              {offer.provider.name}
            </Link>
          ) : null}
          <h3 className="offer-card-model mono">{offer.model_label}</h3>
        </div>
        <StatusBadge status={offer.status} />
      </div>

      <div className="offer-card-chips">
        <TypeBadge type={offer.offer_type} />
        <Requirements offer={offer} />
      </div>

      {p ? (
        <div style={{ marginTop: "0.875rem" }}>
          <PoolMeter
            remaining={num(offer.pool_remaining)}
            size={num(offer.pool_size)}
            unit={unitLabel(offer.pool_unit)}
            pct={p.pct || null}
          />
        </div>
      ) : q ? (
        <p className="mono annot" style={{ marginTop: "0.875rem" }}>
          {q}
        </p>
      ) : (
        <p className="annot" style={{ marginTop: "0.875rem" }}>
          Quota {NOT_STATED.toLowerCase()}
        </p>
      )}

      <dl className="offer-card-facts">
        <div>
          <dt className="label">Verified</dt>
          <dd className="mono">{verified ?? "Never"}</dd>
        </div>
        {offer.start_at ? (
          <div>
            <dt className="label">Opens</dt>
            <dd className="mono">{stampUTC(offer.start_at)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="label">Evidence</dt>
          <dd>
            <VerificationBadge level={offer.verification_level} />
          </dd>
        </div>
      </dl>

      <div className="offer-card-foot">
        <EvidenceLink href={offer.official_evidence_url} />
      </div>
    </article>
  );
}
