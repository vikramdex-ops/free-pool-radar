import Link from "next/link";
import type { OfferWithProvider } from "@/lib/db";
import {
  NOT_STATED,
  ago,
  freshness,
  num,
  pool,
  quota,
  unitLabel,
} from "@/lib/format";
import {
  EvidenceLink,
  FreshnessIndicator,
  StatusBadge,
  TypeBadge,
} from "./ui";

/**
 * The landing page's single live preview (§17).
 *
 * It replaces two things that used to sit in the same section: six offer cards
 * and a twelve-row table built from the identical array. Both were the same
 * data twice, and the table also flattened every provider into one list, so
 * twelve rows could read as nine providers when they were really two.
 *
 * This is the one place on the landing page a route is shown. The complete set
 * lives at /live, which is linked from here and never reproduced in full.
 *
 * Sorting is declared on the face of the component: providers in alphabetical
 * order, then routes by model label, then id. Id is the tiebreaker, so no two
 * rows can share a sort key and the order is stable across renders. Nothing is
 * ordered by score, size or popularity, because none of those exist here.
 */
export function LivePreview({
  offers,
  now,
  limit = 6,
  maxRoutes = 24,
}: {
  offers: OfferWithProvider[];
  now: number;
  /** How many providers to show. */
  limit?: number;
  /**
   * A hard budget on routes shown, independent of the provider count. Six
   * providers with many routes each could otherwise outgrow /live, which is
   * exactly what the no-replica rule exists to prevent.
   */
  maxRoutes?: number;
}) {
  if (offers.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">No verified offers</p>
        <p>
          No route is currently verified as free. Offers appear only after a
          source reports them, and every one carries the URL it was read from.
        </p>
      </div>
    );
  }

  const groups = groupByProvider(offers);

  // Two caps: a provider count and a route budget, and the budget is SPREAD
  // rather than spent on whoever sorts first. The first provider sorts
  // alphabetically, and one provider can publish twenty-four routes, so a
  // budget spent in order filled the whole preview with a single column and
  // pushed every other provider off the page. Dividing the budget by the
  // provider count keeps the preview a preview: several providers, a few
  // routes each, and the total stated underneath.
  //
  // Both caps are stated in the caption below, because a cap the reader cannot
  // see is not a population.
  const perProvider = Math.max(
    1,
    Math.floor(maxRoutes / Math.max(1, limit)),
  );
  const shown: typeof groups = [];
  let routesLeft = maxRoutes;
  const shownRoutes: number[] = [];
  for (const g of groups.slice(0, limit)) {
    if (routesLeft <= 0) break;
    const slice = g.offers.slice(0, Math.min(perProvider, routesLeft));
    shown.push({ ...g, offers: slice });
    routesLeft -= slice.length;
    shownRoutes.push(...slice.map((o) => o.id));
  }

  const hiddenProviders = groups.length - shown.length;
  const hiddenRoutes = offers.length - shownRoutes.length;
  const routesShown = shownRoutes.length;

  return (
    <div className="live-preview">
      <ul className="live-groups">
        {shown.map((g) => (
          <li key={g.slug} className="panel live-group">
            <div className="live-group-head">
              <h3 className="live-group-name">
                <Link href={`/providers/${g.slug}`} className="link">
                  {g.name}
                </Link>
              </h3>
              <p className="annot mono">
                {g.offers.length} route{g.offers.length === 1 ? "" : "s"}
              </p>
            </div>

            <ul className="live-routes">
              {g.offers.map((o) => {
                const p = pool(o);
                return (
                  <li key={o.id} className="live-route">
                    <div className="live-route-main">
                      <span className="mono key" title={o.model_label}>
                        {o.model_label}
                      </span>
                      <TypeBadge type={o.offer_type} />
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="annot live-route-terms">
                      <span className="mono">
                        {p
                          ? `${num(o.pool_remaining)} ${unitLabel(o.pool_unit)}`
                          : (quota(o) ?? NOT_STATED)}
                      </span>
                      {" · "}
                      <FreshnessIndicator
                        freshness={freshness(o.last_verified_at, now)}
                        ago={ago(o.last_verified_at, now)}
                      />
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="live-group-foot">
              <EvidenceLink offerId={g.offers[0]!.id} kind="Evidence" />
            </div>
          </li>
        ))}
      </ul>

      <div className="live-preview-foot">
        {/* The sort order is part of the claim: a reader must not mistake an
            alphabetical list for an implied ranking (§4). */}
        <p className="annot">
          Showing {routesShown} of {num(offers.length)} live routes across{" "}
          {shown.length} of {num(groups.length)} providers, up to {perProvider}{" "}
          route{perProvider === 1 ? "" : "s"} each. Providers A&ndash;Z, then
          route name, then id &mdash; not ranked.
        </p>
        <Link href="/live" className="btn">
          All {offers.length} routes
        </Link>
      </div>

      {hiddenProviders > 0 || hiddenRoutes > 0 ? (
        <p className="annot" style={{ marginTop: "0.75rem" }}>
          {num(hiddenRoutes)} route{hiddenRoutes === 1 ? "" : "s"} at{" "}
          {num(hiddenProviders)} further provider
          {hiddenProviders === 1 ? "" : "s"} not shown here.{" "}
          <Link href="/live" className="link">
            Open the full set
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

interface Group {
  slug: string;
  name: string;
  offers: OfferWithProvider[];
}

/**
 * Group by provider with a declared, total order.
 *
 * Providers sort by name then slug (slug is unique, so it is a genuine
 * tiebreaker rather than an accidental one). Routes sort by model label then
 * id. Both are applied in JS after the read so the order does not depend on the
 * database's own collation.
 */
function groupByProvider(offers: OfferWithProvider[]): Group[] {
  const map = new Map<string, Group>();

  for (const o of offers) {
    const slug = o.provider?.slug;
    if (!slug) continue;
    let g = map.get(slug);
    if (!g) {
      g = { slug, name: o.provider!.name, offers: [] };
      map.set(slug, g);
    }
    g.offers.push(o);
  }

  const groups = [...map.values()];
  for (const g of groups) {
    g.offers.sort(
      (a, b) => a.model_label.localeCompare(b.model_label) || a.id - b.id,
    );
  }
  groups.sort(
    (a, b) =>
      a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
  );
  return groups;
}
