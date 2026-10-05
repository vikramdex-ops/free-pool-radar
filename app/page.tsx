/**
 * Landing page.
 *
 * Every figure here is counted from the database on each request, never
 * hard-coded (§18). The page revalidates on an interval so a data change
 * reaches visitors without a deployment (§76), while the data itself is
 * written by the monitoring pipeline, not by this file.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ChangeFeed, EndedArchive, SourceHealthPanel } from "@/components/Feed";
import { Hero, Upcoming } from "@/components/Hero";
import { REPO_URL } from "@/components/JsonLd";
import { OfferLedger } from "@/components/Ledger";

import { ReadError } from "@/components/ui";
import { Methodology } from "@/components/Methodology";
import {
  getChanges,
  getEndedOffers,
  getEvents,
  getLiveOffers,
  getProviders,
  getStatus,
  isConfigured,
} from "@/lib/db";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Free Pool Radar — every free AI inference pool, tracked live",
  description:
    "Every $0 AI inference route: shared pools, free endpoints, sponsored access and keyless routes, with quotas and verification times.",
  alternates: { canonical: "/" },
};

export default async function Page() {
  const now = Date.now();

  const [
    { data: status, error: statusError },
    { data: offers, error: offersError },
    { data: events, error: eventsError },
    { data: changes, error: changesError },
    { data: ended, error: endedError },
    { data: providers, error: providersError },
  ] = await Promise.all([
    getStatus(),
    getLiveOffers(),
    getEvents(),
    getChanges(80),
    getEndedOffers(),
    getProviders(),
  ]);

  // The hero's four figures are counted, not declared.
  const modelIds = new Set(
    offers.map((o) => o.model_id_text).filter((m): m is string => Boolean(m)),
  ).size;
  // CEO-R01: the denominator behind the distinct-id figure is the rows that
  // carry a model id, not every row. Pairing the count with offers.length
  // compared two different populations, so the sentence was false as written.
  const modelRowsWithId = offers.filter((o) => Boolean(o.model_id_text)).length;
  const cardlessProviders = new Set(
    offers
      .filter((o) => !o.card_required && o.status === "live")
      .map((o) => o.provider?.slug)
      .filter((s): s is string => Boolean(s)),
  ).size;

  const sourcesOk = status?.sources_ok ?? 0;
  const sourcesTotal = status?.sources_total ?? 0;

  return (
    <>
      <main id="main">
        {offersError || eventsError || changesError ? (
          // The hero counts the whole site. Partial data would print wrong
          // figures as fact, so a failed read replaces it, not empties it.
          <div className="wrap" style={{ paddingTop: "2rem" }}>
            <ReadError what="Front-page overview" />
          </div>
        ) : (
          <Hero
          offers={offers}
          events={events}
          changes={changes}
          now={now}
          stats={{
            modelIds,
            modelRows: modelRowsWithId,
            cardlessProviders,
            liveProviders: providers.length,
            liveOffers: offers.filter((o) => o.status === "live").length,
            sourcesLive: sourcesOk,
            sourcesTotal,
            withdrawn: ended.length,
          }}
        />
        )}

        <div className="wrap">
          {/* APR-055: the home page is the only top-level route with no
              page-head, so a reader arriving here and a reader arriving at
              /live met two different page structures. The h1 stays in the
              hero - PRODUCT.md:1606 blesses a distinct hero title and the
              approval says keep h1.hero-title - so this block carries the
              label and the lede and no heading of its own. */}
          <header className="page-head">
            <p className="label">Free Pool Radar</p>
            <p className="page-lede">
              Every free AI inference route we monitor, with the terms that
              apply to it and the time we last confirmed it. This page is the
              overview: it previews each section below and links to the route
              that holds the complete set. Nothing here is scored, and no two
              providers are ranked against each other.
            </p>
          </header>

          <div style={{ paddingTop: "2rem" }}>
            {statusError ? (
              <ReadError what="Source status" />
            ) : (
              <SourceHealthPanel
                sourcesOk={sourcesOk}
                sourcesTotal={sourcesTotal}
                lastSweep={status?.last_sweep_at ?? null}
                nextSweep={status?.next_sweep_at ?? null}
                unhealthy={status?.sources_unhealthy ?? 0}
              />
            )}
          </div>

          {!isConfigured() ? (
            <div className="empty" style={{ marginTop: "2.5rem" }}>
              <p className="empty-title">Database not configured</p>
              <p>
                Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to read the
                live dataset. Nothing is shown here rather than displaying
                sample figures that could be mistaken for live ones.
              </p>
            </div>
          ) : null}

          <section id="soon" className="sect">
            <div className="sect-head">
              <h2 className="sect-title">Starting soon</h2>
              <p className="sect-note">
                Announced pools and events, in the order they open. Sorted
                chronologically, never by size.
              </p>
            </div>
            {eventsError || offersError ? (
              <ReadError what="Upcoming pools and events" />
            ) : (
              <Upcoming events={events} offers={offers} now={now} />
            )}
          </section>

          <section id="live" className="sect">
            <div className="sect-head">
              <h2 className="sect-title">Live now</h2>
              <div className="inline-flex" style={{ gap: "0.5rem" }}>
                <Link href="/live" className="btn">
                  All {offers.length} routes
                </Link>
                <Link href="/providers" className="btn">
                  Providers
                </Link>
                <Link href="/compare" className="btn">
                  Compare
                </Link>
              </div>
            </div>
            {/* Capped here so the landing page stays readable; /live holds the
                complete set with filters. APR-055 lowered this from 40: a
                preview of 40 rows is a copy of /live with a link at the top,
                and the reader had to scroll 1,557px past it to reach anything
                that exists only on this page. */}
            {offersError ? (
              <ReadError what="Live routes" />
            ) : (
              <OfferLedger offers={offers} now={now} limit={12} />
            )}
          </section>

          {changesError ? (
            <ReadError what="Recent changes" />
          ) : (
            <>
              <ChangeFeed
                id="new"
                title="New"
                changes={changes}
                now={now}
                kinds={["new"]}
                limit={5}
                emptyTitle="Nothing new this cycle"
                emptyBody="The last sweep found no offers that were not already on record. New discoveries appear here the moment a monitored source publishes one."
              />

              <ChangeFeed
                id="changed"
                title="Changed"
                changes={changes}
                now={now}
                kinds={[
                  "model_added",
                  "model_removed",
                  "quota_increased",
                  "quota_decreased",
                  "card_required",
                  "card_removed",
                  "subscription_required",
                  "subscription_removed",
                  "rate_limit_changed",
                  "price_changed",
                  "status_changed",
                  "pool_started",
                  "pool_exhausted",
                  "pool_extended",
                  "pool_cancelled",
                ]}
                limit={5}
                emptyTitle="No tracked changes"
                emptyBody="Nothing we track has changed since the last sweep. A quota move, a new card requirement or a rate-limit change appears here with both values."
              />
            </>
          )}

          {endedError ? (
            <ReadError what="Withdrawn offers" />
          ) : (
            <EndedArchive offers={ended} now={now} />
          )}

          <Methodology />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <p className="foot-brand">FREE POOL RADAR</p>
            <p className="annot" style={{ maxWidth: "34ch" }}>
              The live intelligence layer for $0 AI inference.
            </p>
          </div>
          <div>
            <p className="label">Product</p>
            <ul className="foot-links">
              <li><Link href="/timeline">Timeline</Link></li>
              <li><Link href="/providers">Providers</Link></li>
              <li><Link href="/models">Models</Link></li>
              <li><Link href="/compare">Compare</Link></li>
              <li><Link href="/methodology">Methodology</Link></li>
            </ul>
          </div>
          <div>
            <p className="label">API</p>
            <ul className="foot-links">
              <li><Link href="/api/live">/api/live</Link></li>
              <li><Link href="/api/providers">/api/providers</Link></li>
              <li><Link href="/api/models">/api/models</Link></li>
              <li><Link href="/api/changes">/api/changes</Link></li>
            </ul>
          </div>
          <div>
            <p className="label">Open source</p>
            <ul className="foot-links">
              <li>
                <a href={REPO_URL} rel="noopener noreferrer" target="_blank">
                  GitHub repository
                </a>
              </li>
              <li>
                <a href={`${REPO_URL}/blob/main/DATA-LICENSE`} rel="noopener noreferrer" target="_blank">
                  Data licence (CC0)
                </a>
              </li>
              <li>
                <a href={`${REPO_URL}/blob/main/PRODUCT.md`} rel="noopener noreferrer" target="_blank">
                  Full specification
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="hairline" style={{ marginTop: "2.5rem", paddingTop: "1.5rem" }}>
          <p className="annot">
            Free access can be withdrawn, rate-limited, modified or exhausted
            without notice. Always review the provider&rsquo;s current terms,
            privacy policy and usage restrictions before sending sensitive or
            production data.
          </p>
          <p className="annot" style={{ marginTop: "0.75rem" }}>
            Free Pool Radar is an independent information service and is not
            affiliated with the providers listed. All timestamps are UTC.
          </p>
          <p className="annot" style={{ marginTop: "0.75rem" }}>
            The code is MIT licensed and the collected dataset is released
            under CC0 1.0 Universal &mdash; take it, check it, and build on it.
            See the{" "}
            <a href={REPO_URL} rel="noopener noreferrer" target="_blank">
              source repository
            </a>{" "}
            for the full terms.
          </p>
        </div>
      </div>
    </footer>
  );
}
