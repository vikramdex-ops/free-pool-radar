/**
 * JSON-LD structured data (PUL-004).
 *
 * One hard constraint governs everything here: the product NEVER ranks
 * (invariant 1). So this module emits only factual description — names,
 * URLs, dates — and never best, top, worst, #1, rating, aggregateRating,
 * review or any rating/review schema. An ItemList `position` is the
 * display order on the page, not a rank.
 */

export const SITE_URL = "https://free-pool-radar.vercel.app";

/** Renders its payload as a JSON-LD script tag. `<` is escaped so a
 *  stored string can never break out of the script element. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** The site itself, rendered once in the root layout. */
export function websiteSchema(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Free Pool Radar",
    url: SITE_URL,
    description,
  };
}
