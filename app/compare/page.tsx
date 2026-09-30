import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, EvidenceLink } from "@/components/ui";
import { getLiveOffers } from "@/lib/db";
import { NOT_STATED, compact, num, unitLabel } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Compare providers",
  description:
    "Factual side-by-side of free AI providers: card rules, API keys, compatibility, model counts, limits and pool sizes. No ranking.",
  alternates: { canonical: "/compare" },
};

/**
 * §29. A factual comparison, deliberately without a winner.
 *
 * The columns are exactly the dimensions the product considers worth
 * publishing (§57): terms, compatibility, capacity and freshness. Nothing is
 * scored or totalled, because a total would imply the dimensions are
 * commensurable, and they are not.
 */
export default async function ComparePage() {
  const offers = await getLiveOffers();

  // One row per provider, built from its offers.
  const byProvider = new Map<
    string,
    {
      name: string;
      slug: string;
      url: string;
      offers: typeof offers;
    }
  >();
  for (const o of offers) {
    const slug = o.provider?.slug;
    if (!slug) continue;
    const row = byProvider.get(slug) ?? {
      name: o.provider!.name,
      slug,
      url: o.provider!.official_url,
      offers: [],
    };
    row.offers.push(o);
    byProvider.set(slug, row);
  }

  // Providers with the most free routes first — a count, not a judgement.
  const rows = [...byProvider.values()].sort(
    (a, b) => b.offers.length - a.offers.length,
  );

  return (
    <>
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">Compare</p>
          <h1 className="page-title">Side by side</h1>
          <p className="page-lede">
            Every provider with at least one currently usable free route,
            arranged by how many free routes it publishes. That is a count, not
            a judgement: there is no score, no total, and no winner, because
            whether a shared pool or a rate-limited cardless tier suits you
            depends on what you are building.
          </p>
        </header>

        {rows.length === 0 ? (
          <EmptyState title="Nothing to compare">
            No currently verified free offer is available to compare.
          </EmptyState>
        ) : (
          <div className="sect" style={{ paddingTop: 0 }}>
            <div className="tbl-wrap">
              <table className="tbl">
                <caption>
                  {rows.length} providers with live free access
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Dimension</th>
                    {rows.map((r) => (
                      <th key={r.slug} scope="col">
                        <Link href={`/providers/${r.slug}`} className="link">
                          {r.name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="label">
                      Free routes
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug} className="num">
                        {num(r.offers.length)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      Card required
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug}>
                        {anyTrue(r.offers, (o) => o.card_required)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      Subscription required
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug}>
                        {anyTrue(r.offers, (o) => o.access_requires_subscription)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      API key required
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug}>
                        {anyTrue(r.offers, (o) => o.api_key_required)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      Keyless available
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug}>
                        {anyTrue(r.offers, (o) => o.keyless)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      OpenAI compatible
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug}>
                        {anyTrue(r.offers, (o) => o.compatibility_openai)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      Anthropic compatible
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug}>
                        {anyTrue(r.offers, (o) => o.compatibility_anthropic)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      Largest pool
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug} className="num">
                        {largestPool(r.offers)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      Request limits
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug} className="num">
                        {rateSummary(r.offers)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      Access types
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug}>
                        {[...new Set(r.offers.map((o) => o.offer_type))]
                          .map((t) => t.replace(/_/g, " "))
                          .join(", ")}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label">
                      Official site
                    </th>
                    {rows.map((r) => (
                      <td key={r.slug}>
                        <EvidenceLink href={r.url} kind="Official" />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

type Offer = Awaited<ReturnType<typeof getLiveOffers>>[number];

/**
 * "Yes (some)" rather than a bare yes, because a provider can offer both a
 * cardless route and a card-gated one. Collapsing that to "yes" would be
 * exactly the kind of simplification §5 forbids.
 */
function anyTrue(offers: Offer[], pick: (o: Offer) => boolean): string {
  if (offers.length === 0) return NOT_STATED;
  const yes = offers.filter(pick).length;
  if (yes === offers.length) return "Yes";
  if (yes === 0) return "No";
  return `Some (${yes}/${offers.length})`;
}

function largestPool(offers: Offer[]): string {
  const pools = offers.filter((o) => o.pool_size !== null);
  if (pools.length === 0) return NOT_STATED;
  const best = pools.reduce((a, b) => ((b.pool_size ?? 0) > (a.pool_size ?? 0) ? b : a));
  return `${compact(best.pool_size)} ${unitLabel(best.pool_unit)}`;
}

function rateSummary(offers: Offer[]): string {
  const rpm = [...new Set(offers.map((o) => o.rpm).filter((v): v is number => v !== null))];
  const rpd = [...new Set(offers.map((o) => o.rpd).filter((v): v is number => v !== null))];
  const parts: string[] = [];
  if (rpm.length) parts.push(`${rpm.sort((a, b) => a - b).join("/")} rpm`);
  if (rpd.length) parts.push(`${rpd.sort((a, b) => a - b).join("/")} req/day`);
  return parts.length ? parts.join(" · ") : NOT_STATED;
}
