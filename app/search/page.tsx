import type { Metadata } from "next";
import Link from "next/link";
import { getEvents, getLiveOffers, getModels, getProviders, getTimeline } from "@/lib/db";
import { SEARCH_EXAMPLES, search, type HitKind } from "@/lib/search";
import { stampUTC } from "@/lib/format";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search free AI inference across providers, models, offers, events and the full change history.",
  alternates: { canonical: "/search" },
};

const KIND_LABEL: Record<HitKind, string> = {
  provider: "Provider",
  model: "Model",
  offer: "Offer",
  event: "Event",
  change: "Change",
};

/**
 * §30. Global search.
 *
 * The form submits with GET, so a search is a URL. That means a result can be
 * linked, bookmarked and reloaded, and the back button steps through searches
 * rather than abandoning the page — which matters more here than usual, since
 * this is where a reader goes when they already know what they want and just
 * need to find it.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").slice(0, 200);
  const now = Date.now();

  // Nothing is fetched for an empty query. Landing on /search should not cost
  // five queries to render an empty form.
  const results = query
    ? await (async () => {
        const [providers, models, offers, events, changes] = await Promise.all([
          getProviders(),
          getModels(),
          getLiveOffers(),
          getEvents(),
          getTimeline(500),
        ]);
        return search({ query, providers, models, offers, events, changes, now });
      })()
    : null;

  return (
    <main id="main" className="wrap">
      <header className="page-head">
        <p className="label">Search</p>
        <h1 className="page-title">Search everything we track</h1>
        <p className="page-lede">
          Providers, models, offers, events and the change history. Plain words
          work as well as names — &ldquo;no card&rdquo; and &ldquo;keyless&rdquo;
          are understood as questions, not as text to match.
        </p>
      </header>

      <form action="/search" method="get" role="search" className="search-form">
        <label className="sr-only" htmlFor="q">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="claude, no card, keyless, 5B pool…"
          autoComplete="off"
          // Focus on load only when there is nothing to read, so a returning
          // searcher is not pulled off their results.
          autoFocus={query === ""}
          className="search-input"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {query === "" ? (
        <>
          <div className="sect" style={{ paddingTop: "1.5rem" }}>
            <p className="label">Try</p>
            <ul className="search-examples">
              {SEARCH_EXAMPLES.map((e) => (
                <li key={e}>
                  <Link href={`/search?q=${encodeURIComponent(e)}`} className="search-chip">
                    {e}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="sect" style={{ paddingTop: 0 }}>
            <p className="annot" style={{ maxWidth: "58ch" }}>
              The change history is searchable too. A search for a quota figure
              or a withdrawn route will surface the row that recorded it, which
              is often the only place the number appears at all.
            </p>
          </div>
        </>
      ) : results === null ? null : (
        <>
          {/* How the query was read, stated before the results.
              A reader who searched "no card" and got 40 results should be able
              to see that those 40 all had no card, rather than wondering
              whether the phrase matched something. */}
          {results.terms.length > 0 ? (
            <p className="search-terms annot">
              Read as:{" "}
              {results.terms.map((t, i) => (
                <span key={t}>
                  {i > 0 ? " and " : ""}
                  <span className="chip chip-yes">{t}</span>
                </span>
              ))}
              {results.freeText ? (
                <>
                  {" "}
                  containing <span className="chip">{results.freeText}</span>
                </>
              ) : null}
            </p>
          ) : null}

          {results.truncated ? (
            <p className="annot search-truncated">{results.truncated}</p>
          ) : null}

          <p className="annot" style={{ margin: "0.875rem 0 1.5rem" }} aria-live="polite">
            {results.hits.length === 0
              ? `Nothing matched “${query}”.`
              : `${results.hits.length} result${results.hits.length === 1 ? "" : "s"} across ${results.totalConsidered} records.`}
          </p>

          {results.hits.length > 0 ? (
            <ul className="results">
              {results.hits.slice(0, 200).map((h) => (
                <li key={h.id} className="panel result">
                  <p className="label">{KIND_LABEL[h.kind]}</p>
                  <h2 className="result-title">
                    <Link href={h.href} className="link">
                      {h.title}
                    </Link>
                  </h2>
                  <p className="annot">{h.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              <p className="empty-title">No match</p>
              <p>
                Try a provider name, a model id, or a term the search
                understands — &ldquo;no card&rdquo;, &ldquo;keyless&rdquo;,
                &ldquo;shared&rdquo;. The{" "}
                <Link href="/live" className="link">
                  full live list
                </Link>{" "}
                is browsable if you would rather scan than search.
              </p>
            </div>
          )}

          {results.hits.length > 200 ? (
            <p className="annot" style={{ marginTop: "1rem" }}>
              Showing the first 200 of {results.hits.length} matches. Narrow the
              query to see fewer.
            </p>
          ) : null}
        </>
      )}

      <section className="sect" style={{ paddingTop: "2.5rem" }}>
        <div className="sect-head">
          <h2 className="sect-title">Browse instead</h2>
        </div>
        <ul className="browse-links">
          <li>
            <Link href="/live" className="link">
              Every live free route
            </Link>
          </li>
          <li>
            <Link href="/providers" className="link">
              All providers
            </Link>
          </li>
          <li>
            <Link href="/models" className="link">
              All models
            </Link>
          </li>
          <li>
            <Link href="/events" className="link">
              All events
            </Link>
          </li>
          <li>
            <Link href="/timeline" className="link">
              Change history
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
