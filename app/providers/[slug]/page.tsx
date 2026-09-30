import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { OfferLedger } from "@/components/Ledger";
import { EvidenceLink, FreshnessIndicator, StatusBadge } from "@/components/ui";
import {
  getChanges,
  getOffersForProvider,
  getProvider,
} from "@/lib/db";
import { truncateDescription } from "@/lib/metadata";
import {
  NOT_STATED,
  ago,
  compact,
  freshness,
  num,
  quota,
  stampUTC,
  unitLabel,
} from "@/lib/format";

export const revalidate = 300;

/** §40: metadata is generated from the stored record, not hard-coded. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getProvider(slug);
  if (!provider) return { title: "Provider not found" };

  const live = provider.live_offer_count;
  const models = provider.free_model_count;
  const parts = [
    `${provider.name} free AI API`,
    models ? `${models} free model ids` : null,
    live ? `${live} live free offers` : null,
  ].filter(Boolean);

  return {
    title: parts.join(" — "),
    description: truncateDescription(
      provider.description ??
        `Free AI API access from ${provider.name}: quotas, card rules, rate limits, verification time and withdrawn history.`,
    ),
    alternates: { canonical: `/providers/${provider.slug}` },
  };
}

export default async function ProviderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = Date.now();
  const provider = await getProvider(slug);
  if (!provider) notFound();

  const [offers, changes] = await Promise.all([
    getOffersForProvider(slug),
    getChanges(120),
  ]);

  const providerChanges = changes.filter((c) => c.provider?.slug === slug);
  const live = offers.filter((o) => o.status === "live" || o.status === "changed");
  const ended = offers.filter((o) => o.status === "ended");

  return (
    <>
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">
            <Link href="/providers">Providers</Link> / {provider.slug}
          </p>
          <h1 className="page-title">{provider.name}</h1>
          {provider.description ? (
            <p className="page-lede">{provider.description}</p>
          ) : null}

          <div
            className="inline-flex"
            style={{ gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}
          >
            <span
              className={`badge ${
                provider.status === "active"
                  ? "badge-live"
                  : provider.status === "shut_down"
                    ? "badge-ended"
                    : "badge-stale"
              }`}
            >
              {provider.status.replace("_", " ").toUpperCase()}
            </span>
            {provider.provider_type ? (
              <span className="chip">{provider.provider_type}</span>
            ) : null}
            {provider.country ? (
              <span className="chip">{provider.country}</span>
            ) : null}
            <EvidenceLink href={provider.official_url} kind="Official website" />
          </div>
        </header>

        <section className="sect" style={{ paddingTop: 0 }}>
          <div className="sect-head">
            <h2 className="sect-title">Current position</h2>
            {provider.last_verified_at ? (
              <FreshnessIndicator
                freshness={freshness(provider.last_verified_at, now)}
                ago={ago(provider.last_verified_at, now)}
              />
            ) : null}
          </div>

          <dl className="facts">
            <div>
              <dt className="label">Free model ids</dt>
              <dd className="mono">
                {provider.free_model_count > 0
                  ? num(provider.free_model_count)
                  : NOT_STATED}
              </dd>
            </div>
            <div>
              <dt className="label">Live offers</dt>
              <dd className="mono">
                {provider.live_offer_count > 0
                  ? num(provider.live_offer_count)
                  : NOT_STATED}
              </dd>
            </div>
            <div>
              <dt className="label">Card required</dt>
              <dd>
                {cardSummary(offers)}
              </dd>
            </div>
            <div>
              <dt className="label">Subscription required</dt>
              <dd>{subSummary(offers)}</dd>
            </div>
            <div>
              <dt className="label">Largest pool</dt>
              <dd className="mono">{poolSummary(offers)}</dd>
            </div>
            <div>
              <dt className="label">Last verified</dt>
              <dd className="mono">{stampUTC(provider.last_verified_at) ?? "Never"}</dd>
            </div>
          </dl>
        </section>

        <section className="sect" style={{ paddingTop: 0 }}>
          <div className="sect-head">
            <h2 className="sect-title">Free access now</h2>
            <p className="sect-note">
              Every route currently usable from {provider.name}, with the terms
              that apply to each.
            </p>
          </div>
          <OfferLedger offers={live} now={now} showProvider={false} />
        </section>

        {ended.length ? (
          <section className="sect" style={{ paddingTop: 0 }}>
            <div className="sect-head">
              <h2 className="sect-title">Withdrawn at {provider.name}</h2>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <caption>{ended.length} withdrawn offer(s)</caption>
                <thead>
                  <tr>
                    <th scope="col">Offer</th>
                    <th scope="col">Ended</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {ended.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span className="key mono">{o.model_label}</span>
                        <div style={{ marginTop: "0.375rem" }}>
                          <StatusBadge status="ended" />
                        </div>
                      </td>
                      <td className="num">{stampUTC(o.ended_at)}</td>
                      <td>{o.exhaustion_condition ?? NOT_STATED}</td>
                      <td>
                            <EvidenceLink offerId={o.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="sect" style={{ paddingTop: 0 }}>
          <div className="sect-head">
            <h2 className="sect-title">Change history</h2>
            <p className="sect-note">
              Every recorded change for {provider.name}, newest first.
            </p>
          </div>
          {providerChanges.length === 0 ? (
            <div className="empty">
              <p className="empty-title">No recorded changes</p>
              <p>
                Nothing about {provider.name}&rsquo;s free access has changed
                since monitoring began. This is not the same as never having
                changed &mdash; it is what has been observed.
              </p>
            </div>
          ) : (
            <ol className="feed">
              {providerChanges.map((c) => (
                <li key={c.id} className="panel feed-row">
                  <div className="feed-when">
                    <p className="mono feed-stamp">{stampUTC(c.detected_at)}</p>
                    <p className="annot mono">{ago(c.detected_at, now)}</p>
                  </div>
                  <div className="feed-what">
                    <p className="label" style={{ color: "var(--t-upcoming)" }}>
                      {c.change_type.replace(/_/g, " ").toUpperCase()}
                    </p>
                    <p className="annot">
                      {c.field ? `${c.field.replace(/_/g, " ")}: ` : ""}
                      <span className="mono">{c.old_value ?? "not stated"}</span>
                      {" → "}
                      <span className="mono strong">{c.new_value ?? "not stated"}</span>
                    </p>
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

        <section className="sect" style={{ paddingTop: 0 }}>
          <div className="sect-head">
            <h2 className="sect-title">Conditions and privacy</h2>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <caption>
                As published by {provider.name}. Absent figures are shown as not
                publicly stated rather than guessed.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col">Quota</th>
                  <th scope="col">Commercial use</th>
                  <th scope="col">Data policy</th>
                  <th scope="col">Retention</th>
                  <th scope="col">Evidence level</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="key mono">{o.model_label}</span>
                    </td>
                    <td className="num">{quota(o) ?? NOT_STATED}</td>
                    <td>{o.commercial_use ?? NOT_STATED}</td>
                    <td>{o.data_policy ?? NOT_STATED}</td>
                    <td>{o.retention_policy ?? NOT_STATED}</td>
                    <td>{o.verification_level.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

/** "No card" only when every live offer agrees. A mixed provider says so. */
function cardSummary(offers: { card_required: boolean }[]): string {
  if (offers.length === 0) return NOT_STATED;
  const needs = offers.filter((o) => o.card_required).length;
  if (needs === 0) return "No card required";
  if (needs === offers.length) return "Card required";
  return `Mixed — ${offers.length - needs} of ${offers.length} need no card`;
}

function subSummary(offers: { access_requires_subscription: boolean }[]): string {
  if (offers.length === 0) return NOT_STATED;
  const needs = offers.filter((o) => o.access_requires_subscription).length;
  if (needs === 0) return "No subscription required";
  if (needs === offers.length) return "Subscription required";
  return `Mixed — ${offers.length - needs} of ${offers.length} need none`;
}

function poolSummary(
  offers: { pool_size: number | null; pool_unit: string | null }[],
): string {
  const pools = offers.filter((o) => o.pool_size !== null);
  if (pools.length === 0) return NOT_STATED;
  const best = pools.reduce((a, b) => ((b.pool_size ?? 0) > (a.pool_size ?? 0) ? b : a));
  return `${compact(best.pool_size)} ${unitLabel(best.pool_unit)}`;
}
