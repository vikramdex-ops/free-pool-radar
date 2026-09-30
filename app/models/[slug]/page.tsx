import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EmptyState, EvidenceLink, StatusBadge } from "@/components/ui";
import { JsonLd, SITE_URL } from "@/components/JsonLd";
import {
  getModel,
  getModels,
  getOffersForModelId,
} from "@/lib/db";
import { NOT_STATED, ago, freshness, num, quota, stampUTC } from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const model = await getModel(slug);
  if (!model) return { title: "Model not found" };
  return {
    title: `${model.display_name} free API access`,
    description: `Providers currently offering ${model.display_name} at no cost, with quotas, card requirements, API compatibility and last verification time — plus the providers that stopped offering it.`,
    alternates: { canonical: `/models/${model.slug}` },
  };
}

/**
 * §27. A model detail page answers two questions: who serves it for free right
 * now, and who used to. The second half matters as much as the first — a
 * provider that quietly dropped a model is exactly the kind of thing a reader
 * is looking for.
 */
export default async function ModelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = Date.now();
  const model = await getModel(slug);
  if (!model) notFound();

  // Offers are matched on the provider-local model id, so the same string can
  // exist at several providers with different terms.
  const offers = await getOffersForModelId(model.model_id);
  const live = offers.filter(
    (o) => o.status === "live" || o.status === "changed" || o.status === "ending",
  );
  const ended = offers.filter((o) => o.status === "ended");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `${model.display_name} free API access`,
          url: `${SITE_URL}/models/${model.slug}`,
        }}
      />
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">
            <Link href="/models">Models</Link> / {model.slug}
          </p>
          <h1 className="page-title mono">{model.display_name}</h1>
          <p className="page-lede">
            {model.model_id}
            {model.family ? ` · ${model.family} family` : ""}
            {model.context_window
              ? ` · ${num(model.context_window)} token context`
              : ""}
          </p>
          <p className="annot" style={{ marginTop: "0.75rem" }}>
            First seen {stampUTC(model.first_seen_at)}. A model appearing here
            means it was found on a free route, not that it is universally free.
          </p>
        </header>

        <section className="sect" style={{ paddingTop: 0 }}>
          <div className="sect-head">
            <h2 className="sect-title">Free right now</h2>
            <p className="sect-note">
              Providers currently serving this model at no cost.
            </p>
          </div>

          {live.length === 0 ? (
            <EmptyState title="No current free access">
              No provider is currently offering {model.display_name} at $0
              through a route we monitor. That is a statement about our tracked
              sources, not proof that no free access exists anywhere.
            </EmptyState>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <caption>
                  {live.length} provider{live.length === 1 ? "" : "s"} with
                  verified free access
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Provider</th>
                    <th scope="col">Status</th>
                    <th scope="col">Access type</th>
                    <th scope="col">Quota</th>
                    <th scope="col">Card</th>
                    <th scope="col">Subscription</th>
                    <th scope="col">Compatible</th>
                    <th scope="col">Last verified</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.provider ? (
                          <Link href={`/providers/${o.provider.slug}`} className="link key">
                            {o.provider.name}
                          </Link>
                        ) : (
                          <span className="key">Unknown</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>{o.offer_type.replace(/_/g, " ")}</td>
                      <td className="num">{quota(o) ?? NOT_STATED}</td>
                      <td>{o.card_required ? "Required" : "No"}</td>
                      <td>{o.access_requires_subscription ? "Required" : "No"}</td>
                      <td>
                        <span className="inline-flex" style={{ gap: "0.25rem" }}>
                          {o.compatibility_openai ? (
                            <span className="chip">OpenAI</span>
                          ) : null}
                          {o.compatibility_anthropic ? (
                            <span className="chip">Anthropic</span>
                          ) : null}
                          {!o.compatibility_openai && !o.compatibility_anthropic
                            ? NOT_STATED
                            : null}
                        </span>
                      </td>
                      <td>
                        <span className="mono">
                          {ago(o.last_verified_at, now) ?? "Never"}
                        </span>
                        <div style={{ marginTop: "0.25rem" }}>
                          <span
                            className={`badge ${
                              freshness(o.last_verified_at, now) === "fresh"
                                ? "badge-live"
                                : freshness(o.last_verified_at, now) === "aging"
                                  ? "badge-info"
                                  : freshness(o.last_verified_at, now) === "unverified"
                                    ? "badge-stale"
                                    : "badge-ended"
                            }`}
                          >
                            {freshness(o.last_verified_at, now).replace(/_/g, " ").toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td>
                        <EvidenceLink offerId={o.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {ended.length ? (
          <section className="sect" style={{ paddingTop: 0 }}>
            <div className="sect-head">
              <h2 className="sect-title">Previously free</h2>
              <p className="sect-note">
                Providers that stopped offering this model at no cost. Kept as a
                permanent record.
              </p>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <caption>{ended.length} withdrawn route(s)</caption>
                <thead>
                  <tr>
                    <th scope="col">Provider</th>
                    <th scope="col">Ended</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {ended.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.provider ? (
                          <Link href={`/providers/${o.provider.slug}`} className="link key">
                            {o.provider.name}
                          </Link>
                        ) : (
                          <span className="key">Unknown</span>
                        )}
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
      </main>
    </>
  );
}

/** The model index is its own page so the slug list stays linkable. */
export async function generateStaticParams() {
  const models = await getModels(200);
  return models.map((m) => ({ slug: m.slug }));
}
