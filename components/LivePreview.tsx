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
import { TiltCard, StaggerContainer } from "./Cinematic";

/**
 * The landing page's single live preview (§17) - Enhanced with 3D effects.
 */
export function LivePreview({
  offers,
  now,
  limit = 6,
  maxRoutes = 24,
}: {
  offers: OfferWithProvider[];
  now: number;
  limit?: number;
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
      <StaggerContainer className="live-groups">
        {shown.map((g) => (
          <TiltCard key={g.slug} className="stagger-item">
            <li className="panel panel-enhanced live-group">
              <div className="live-group-head">
                <h3 className="live-group-name">
                  <Link href={`/providers/${g.slug}`}>{g.name}</Link>
                </h3>
                <span className="annot">{g.offers.length} {g.offers.length === 1 ? "route" : "routes"}</span>
              </div>

              <ul className="live-routes">
                {g.offers.map((o) => (
                  <li key={o.id} className="live-route">
                    <div className="live-route-main">
                      <TypeBadge type={o.offer_type} />
                      <span className="key">{o.model_label}</span>
                      <FreshnessIndicator value={freshness(o.verified_at, now)} />
                    </div>

                    <p className="live-route-terms">
                      {o.pool_size !== null ? (
                        <span className="mono">
                          {pool(o.pool_size, o.pool_unit)}
                        </span>
                      ) : null}
                      {o.quota_amount !== null ? (
                        <span className="mono">
                          {quota(o.quota_amount, o.quota_unit, o.quota_period)}
                        </span>
                      ) : null}
                      {o.card_required ? (
                        <span className="flag">Card required</span>
                      ) : (
                        <span className="flag">No card</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="live-group-foot">
                <EvidenceLink
                  url={g.offers[0]?.source_url ?? null}
                  verifiedAt={g.offers[0]?.verified_at ?? null}
                />
              </div>
            </li>
          </TiltCard>
        ))}
      </StaggerContainer>

      <div className="live-preview-foot">
        <p className="annot">
          Showing {routesShown} {routesShown === 1 ? "route" : "routes"} from{" "}
          {shown.length} {shown.length === 1 ? "provider" : "providers"}.
          {hiddenRoutes > 0 || hiddenProviders > 0 ? (
            <>
              {" "}
              {hiddenRoutes} more {hiddenRoutes === 1 ? "route" : "routes"}{" "}
              {hiddenProviders > 0 ? (
                <>
                  from {hiddenProviders} more{" "}
                  {hiddenProviders === 1 ? "provider" : "providers"}
                </>
              ) : null}{" "}
              available.
            </>
          ) : null}
        </p>
        <Link href="/live" className="btn">
          View all {num(offers.length)} live routes
        </Link>
      </div>
    </div>
  );
}

function groupByProvider(offers: OfferWithProvider[]) {
  const map = new Map<
    string,
    { slug: string; name: string; offers: OfferWithProvider[] }
  >();

  for (const o of offers) {
    const slug = o.provider?.slug ?? "unknown";
    const name = o.provider?.name ?? "Unknown";
    if (!map.has(slug)) {
      map.set(slug, { slug, name, offers: [] });
    }
    map.get(slug)!.offers.push(o);
  }

  const groups = Array.from(map.values());
  groups.sort((a, b) => a.name.localeCompare(b.name));

  for (const g of groups) {
    g.offers.sort((a, b) => {
      const mc = a.model_label.localeCompare(b.model_label);
      return mc !== 0 ? mc : a.id - b.id;
    });
  }

  return groups;
}
