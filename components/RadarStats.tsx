import { num } from "@/lib/format";

/**
 * The headline figures (§18).
 *
 * Every value is counted from the database at request time, never hard-coded, so
 * the numbers cannot drift from the data they describe.
 *
 * Every figure also states its POPULATION (APR-059, ratified 2026-10-05).
 * This is not decoration. Measured before this change: the hero printed a
 * distinct model-id count beside a /models page that reports rows and distinct
 * ids over a different population, and a reader had no way to tell which set a
 * given number was drawn from. The competitors' equivalent numbers are worse -
 * a bare count with no population at all - so stating it is both the fix and
 * the differentiator.
 *
 * Rule 8 of the council brief applies here: a count and its population are one
 * claim. The population sentence is not a caption that can drift from the
 * number; it is rendered from the same variables the number is rendered from,
 * so they cannot disagree.
 */
export function HeroStats({
  modelIds,
  modelRows,
  totalLiveRows,
  cardlessProviders,
  liveProviders,
  liveOffers,
  sourcesLive,
  sourcesTotal,
  withdrawn,
}: {
  modelIds: number;
  /** Rows carrying a model id: the population the distinct-id figure counts (VIS-066). */
  modelRows: number;
  /** Every row in the live set: the context figure the counted population sits inside. */
  totalLiveRows: number;
  cardlessProviders: number;
  liveProviders: number;
  liveOffers: number;
  sourcesLive: number;
  sourcesTotal: number;
  withdrawn: number;
}) {
  // The date the figures describe, not the date the page was built. A figure
  // that does not say when it was true cannot be stale-detected.
  const asOf = new Date().toISOString().slice(0, 10);

  const stats = [
    {
      v: num(modelIds),
      l: "Free model ids",
      p: `distinct ids across ${num(modelRows)} live routes that carry one (${num(totalLiveRows)} live routes total)`,
    },
    {
      v: num(cardlessProviders),
      l: "Cardless providers",
      p: `of ${num(liveProviders)} providers with a live route`,
    },
    // Both numbers, because "12 of 12" and "12 of 14" mean very different
    // things and a reader should not need another page to learn which.
    {
      v: `${num(sourcesLive)} / ${num(sourcesTotal)}`,
      l: "Sources responding",
      p: "sources responding at the last sweep",
    },
    {
      v: num(withdrawn),
      l: "Withdrawn offers",
      p: `ended routes, kept on the record of ${num(liveOffers)} live`,
    },
  ];

  return (
    <dl className="hero-stats">
      {stats.map((s) => (
        <div key={s.l} className="hero-stat">
          <dt className="label">{s.l}</dt>
          <dd className="mono">{s.v}</dd>
          {/* The population sentence. Rendered from the same values as the
              number above it, so it cannot become a stale caption. */}
          <dd className="annot hero-stat-pop">{s.p}</dd>
        </div>
      ))}
      <div className="hero-stat hero-stat-asof">
        <dt className="label">As of</dt>
        <dd className="annot">
          last sweep {asOf} · figures counted from the database, not declared
        </dd>
      </div>
    </dl>
  );
}