import { num } from "@/lib/format";

/**
 * The headline figures (§18).
 *
 * Every value is counted from the database at request time, never hard-coded, so
 * the numbers cannot drift from the data they describe.
 */
export function HeroStats({
  modelIds,
  cardlessProviders,
  sourcesLive,
  sourcesTotal,
  withdrawn,
}: {
  modelIds: number;
  cardlessProviders: number;
  sourcesLive: number;
  sourcesTotal: number;
  withdrawn: number;
}) {
  const stats = [
    { v: num(modelIds), l: "Free model ids" },
    { v: num(cardlessProviders), l: "Cardless providers" },
    // Both numbers, because "12 of 12" and "12 of 14" mean very different
    // things and a reader should not need another page to learn which.
    {
      v: `${num(sourcesLive)} / ${num(sourcesTotal)}`,
      l: "Sources responding",
    },
    { v: num(withdrawn), l: "Withdrawn offers" },
  ];

  return (
    <dl className="hero-stats">
      {stats.map((s) => (
        <div key={s.l} className="hero-stat">
          <dt className="label">{s.l}</dt>
          <dd className="mono">{s.v}</dd>
        </div>
      ))}
    </dl>
  );
}
