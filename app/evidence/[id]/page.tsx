import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getChangesForOffer,
  getObservationsForOffer,
  getOffer,
} from "@/lib/db";
import { ReadError } from "@/components/ui";
import { truncateDescription } from "@/lib/metadata";
import { JsonLd, SITE_URL } from "@/components/JsonLd";
import {
  CHANGE_LABEL,
  FIELD_LABEL,
  NOT_STATED,
  VERIFICATION_LABEL,
  ago,
  freshness,
  num,
  quota,
  stampUTC,
  unitLabel,
} from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data: offer, error: offerError } = await getOffer(Number(id));
  if (offerError) return { title: "Evidence unavailable" };
  if (!offer) return { title: "Evidence not found" };
  return {
    title: `Evidence — ${offer.provider?.name ?? "provider"} ${offer.model_label}`,
    description: truncateDescription(
      `How and when Free Pool Radar verified free access to ${offer.model_label} at ${offer.provider?.name ?? "this provider"}, with the official source.`,
    ),
    alternates: { canonical: `/evidence/${offer.id}` },
  };
}

/**
 * The evidence page.
 *
 * Every "Evidence" link on the site points here rather than straight at the
 * source URL. Many of those URLs are machine endpoints, and sending a reader to
 * a raw JSON catalogue to confirm one rate limit is not evidence — it is a
 * chore, and the reader cannot tell which field they are meant to check.
 *
 * So this page states the claim first, in our words, then shows the extracted
 * figure, then the provenance, and only then offers the original URL as a
 * clearly labelled secondary link. Someone who wants to read the raw source can
 * still; someone who just wants to know where the number came from does not have
 * to.
 */
export default async function EvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId)) notFound();

  const now = Date.now();
  const { data: offer, error: offerError } = await getOffer(offerId);
  if (offerError) {
    return (
      <main id="main" className="wrap">
        <div className="sect">
          <ReadError what={`Evidence for offer ${offerId}`} />
        </div>
      </main>
    );
  }
  if (!offer) notFound();

  const [{ data: observations }, { data: changes, error: changesError }] =
    await Promise.all([
      getObservationsForOffer(offerId),
      getChangesForOffer(offerId),
    ]);

  const limit = quota(offer);
  const verified = offer.last_verified_at
    ? ago(offer.last_verified_at, now)
    : null;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `Evidence — ${offer.provider?.name ?? "provider"} ${offer.model_label}`,
          url: `${SITE_URL}/evidence/${offer.id}`,
        }}
      />
    <main id="main" className="wrap">
      <header className="page-head">
        <p className="label">Evidence</p>
        <h1 className="page-title">
          {offer.provider ? (
            <Link href={`/providers/${offer.provider.slug}`} className="link">
              {offer.provider.name}
            </Link>
          ) : (
            "Unknown provider"
          )}
          <span style={{ color: "var(--t-ink-3)" }}> / </span>
          <span className="mono">{offer.model_label}</span>
        </h1>
        <p className="page-lede">
          What we published for this route, where each figure came from, and when
          we last confirmed it. Nothing on this page is inferred — if a provider
          does not publish something, it is listed as not stated.
        </p>
      </header>

      {/* The claim, stated plainly before any provenance. */}
      <section className="sect" style={{ paddingTop: "1.5rem" }}>
        <div className="sect-head">
          <h2 className="sect-title">The claim</h2>
        </div>

        <div className="panel claim">
          <p className="claim-line">
            <strong>{offer.provider?.name}</strong> offers{" "}
            <span className="mono">{offer.model_label}</span> at no cost
            {offer.card_required ? ", but requires a payment method" : ", with no payment method required"}
            {offer.access_requires_subscription
              ? " and an active subscription"
              : " and no subscription"}
            {offer.api_key_required ? "." : ", reachable without an API key."}
          </p>

          <dl className="facts" style={{ marginBottom: 0 }}>
            <div>
              <dt className="label">Access type</dt>
              <dd>{offer.offer_type.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="label">Status</dt>
              <dd>{offer.status.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="label">Quota</dt>
              <dd className="mono">{limit ?? NOT_STATED}</dd>
            </div>
            <div>
              <dt className="label">OpenAI compatible</dt>
              <dd>{offer.compatibility_openai ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="label">Anthropic compatible</dt>
              <dd>{offer.compatibility_anthropic ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="label">Pool remaining</dt>
              <dd className="mono">
                {offer.pool_remaining === null
                  ? NOT_STATED
                  : `${num(offer.pool_remaining)} ${unitLabel(offer.pool_unit)}`}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Provenance: who said it, how strong it is, and when we read it. */}
      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="sect-head">
          <h2 className="sect-title">Where this came from</h2>
        </div>

        <dl className="facts">
          <div>
            <dt className="label">Evidence level</dt>
            <dd>{VERIFICATION_LABEL[offer.verification_level]}</dd>
          </div>
          <div>
            <dt className="label">Last verified</dt>
            <dd>
              <span className="mono">{stampUTC(offer.last_verified_at) ?? "Never"}</span>
              {verified ? (
                <span className="annot" style={{ display: "block" }}>
                  {verified} ·{" "}
                  {freshness(offer.last_verified_at, now).replace(/_/g, " ")}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="label">First seen</dt>
            <dd className="mono">{stampUTC(offer.first_discovered_at)}</dd>
          </div>
          <div>
            <dt className="label">Provenance</dt>
            <dd>
              {offer.is_seed_data ? "Researched" : "Observed"}
              <span className="annot" style={{ display: "block" }}>
                {offer.is_seed_data
                  ? "Established by documented research; not re-read by an automated collector."
                  : "Confirmed by an automated source on a recent sweep."}
              </span>
            </dd>
          </div>
        </dl>

        {/* The original, last and clearly labelled. Most of these URLs are
            machine endpoints, so this is deliberately not the primary action. */}
        <div className="evidence-source">
          <p className="label">Original source</p>
          {offer.official_evidence_url ? (
            <>
              <p className="annot" style={{ margin: "0.5rem 0 0.75rem" }}>
                This is the address the figure was read from. Depending on the
                provider it is a documentation page, a pricing page, or a JSON
                endpoint &mdash; the last of which opens as raw data.
              </p>
              <div
                className="evidence-url mono"
                title={offer.official_evidence_url}
              >
                {offer.official_evidence_url}
              </div>
              <a
                href={offer.official_evidence_url}
                className="btn"
                target="_blank"
                rel="noopener noreferrer nofollow"
                style={{ marginTop: "0.75rem" }}
              >
                Open raw source
                <span aria-hidden="true"> →</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          ) : (
            <p className="annot" style={{ marginTop: "0.5rem" }}>
              No official source is recorded for this route.
            </p>
          )}
        </div>
      </section>

      {/* History for this specific route, so "when did this change" is answerable
          without reading the whole timeline. */}
      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="sect-head">
          <h2 className="sect-title">History for this route</h2>
          {changes.length > 0 ? (
            <Link href="/timeline" className="link-ev">
              Full timeline
              <span aria-hidden="true"> →</span>
            </Link>
          ) : null}
        </div>

        {changesError ? (
          <ReadError what="History for this route" />
        ) : changes.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No recorded changes</p>
            <p>
              Nothing about this route has changed since we began tracking it.
              That is what has been observed, not a claim that it never changed.
            </p>
          </div>
        ) : (
          <ol className="feed">
            {changes.map((c) => (
              <li key={c.id} className="panel feed-row">
                <div className="feed-when">
                  <p className="mono feed-stamp">{stampUTC(c.detected_at)}</p>
                  <p className="annot mono">{ago(c.detected_at, now)}</p>
                </div>
                <div className="feed-what">
                  <p className="label" style={{ color: "var(--t-upcoming)" }}>
                    {CHANGE_LABEL[c.change_type] ?? c.change_type}
                  </p>
                  {/* A new offer has no previous value, so an arrow from
                      "not stated" describes nothing. Say what happened. */}
                  {c.change_type === "new" ? (
                    <p className="annot">
                      Recorded as a{" "}
                      <span className="mono strong">
                        {c.new_value?.replace(/_/g, " ")}
                      </span>{" "}
                      offer.
                    </p>
                  ) : c.field ? (
                    <p className="annot">
                      {FIELD_LABEL[c.field] ?? c.field}:{" "}
                      <span className="mono">{c.old_value ?? "not stated"}</span>
                      {" → "}
                      <span className="mono strong">{c.new_value ?? "not stated"}</span>
                    </p>
                  ) : null}
                  {c.evidence ? <p className="annot">{c.evidence}</p> : null}
                </div>
                <div className="feed-source">
                  {c.source_url ? (
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
        )}
      </section>

      {observations.length > 0 ? (
        <section className="sect" style={{ paddingTop: 0 }}>
          <div className="sect-head">
            <h2 className="sect-title">Recorded observations</h2>
            <p className="sect-note">
              One row per sweep that saw a change. The full evidence trail,
              including raw payloads, is kept server-side and is not public.
            </p>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <caption>{observations.length} observation(s)</caption>
              <thead>
                <tr>
                  <th scope="col">Observed</th>
                  <th scope="col">Status</th>
                  <th scope="col">Quota</th>
                  <th scope="col">Pool remaining</th>
                  <th scope="col">Evidence level</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((o) => (
                  <tr key={o.id}>
                    <td className="num">{stampUTC(o.observed_at)}</td>
                    <td>{o.status?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="num">
                      {o.rpm !== null ? `${num(o.rpm)} rpm` : "—"}
                      {o.rpd !== null ? ` · ${num(o.rpd)} req/day` : ""}
                    </td>
                    <td className="num">
                      {o.pool_remaining === null
                        ? "—"
                        : `${num(o.pool_remaining)} ${unitLabel(offer.pool_unit)}`}
                    </td>
                    <td>
                      {o.verification_level
                        ? VERIFICATION_LABEL[o.verification_level]
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
    </>
  );
}
