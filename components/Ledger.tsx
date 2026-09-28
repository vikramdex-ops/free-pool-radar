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

  return (
    <div className="ledger">
      <div className="ledger-cards">
        {shown.slice(0, 6).map((o) => (
          <OfferCard key={o.id} offer={o} now={now} />
        ))}
      </div>

      <div className="tbl-wrap ledger-table">
        <table className="tbl">
          <caption>
            {hidden > 0
              ? `Showing ${shown.length} of ${offers.length} currently usable free routes`
              : `${offers.length} currently usable free route${offers.length === 1 ? "" : "s"}`}
          </caption>
          <thead>
            <tr>
              {showProvider ? <th scope="col">Provider</th> : null}
              <th scope="col">Model or route</th>
              <th scope="col">Access</th>
              <th scope="col">Status</th>
              <th scope="col">Card</th>
              <th scope="col">Subscription</th>
              <th scope="col">Key</th>
              <th scope="col">Pool or quota</th>
              <th scope="col">Compatible</th>
              <th scope="col">Last verified</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => {
              const p = pool(o);
              return (
                <tr key={o.id}>
                  {showProvider ? (
                    <td>
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
                  <td>
                    <span className="key mono">{o.model_label}</span>
                  </td>
                  <td>
                    <TypeBadge type={o.offer_type} />
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td>
                    <Condition
                      ok={!o.card_required}
                      when="No card"
                      otherwise="Card required"
                    />
                  </td>
                  <td>
                    <Condition
                      ok={!o.access_requires_subscription}
                      when="No sub"
                      otherwise="Sub required"
                    />
                  </td>
                  <td>
                    <Condition
                      ok={o.keyless}
                      when="Keyless"
                      otherwise="Key required"
                    />
                  </td>
                  <td className="num">
                    {p
                      ? `${num(o.pool_remaining)} ${unitLabel(o.pool_unit)}`
                      : (quota(o) ?? NOT_STATED)}
                  </td>
                  <td>
                    <span className="inline-flex" style={{ gap: "0.25rem" }}>
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
                    <EvidenceLink href={o.official_evidence_url} />
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
        <Condition
          ok={!offer.card_required}
          when="No card"
          otherwise="Card required"
        />
        <Condition
          ok={!offer.access_requires_subscription}
          when="No subscription"
          otherwise="Subscription"
        />
        {offer.keyless ? <span className="chip chip-yes">Keyless</span> : null}
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
