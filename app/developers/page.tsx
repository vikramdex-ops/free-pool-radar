import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "The Free Pool Radar public API, datasets and feed: read-only, no key required, and the same numbers the site renders.",
  alternates: { canonical: "/developers" },
};

/**
 * The developers page.
 *
 * The hero used to send people straight at /api/live, which answers a request
 * with raw JSON and no explanation of what they were looking at. This page is
 * that explanation: what exists, what it costs, what shape it comes in, and
 * where to go next.
 *
 * No figure appears in this file. Every count and timestamp on this page is
 * rendered by the API it describes; copying one in here would be the first
 * step toward a hard-coded number that drifts from the data.
 */

const ENDPOINTS: { method: string; path: string; what: string }[] = [
  { method: "GET", path: "/api/live", what: "Free routes usable right now" },
  { method: "GET", path: "/api/upcoming", what: "Announced pools and events, by start time" },
  { method: "GET", path: "/api/ended", what: "Withdrawn access, retained permanently" },
  { method: "GET", path: "/api/providers", what: "The provider registry" },
  { method: "GET", path: "/api/models", what: "Every model seen on a free route" },
  { method: "GET", path: "/api/events", what: "Shared pools and promotional events" },
  { method: "GET", path: "/api/changes", what: "The append-only change log" },
  { method: "GET", path: "/api/stats", what: "Headline counts and the verification cycle" },
  { method: "GET", path: "/api/dataset", what: "The whole dataset in one document" },
  { method: "GET", path: "/data/latest.csv", what: "The live set, flattened to CSV" },
  { method: "GET", path: "/feed.xml", what: "Atom feed of recent changes" },
];

export default function DevelopersPage() {
  return (
    <main id="main" className="wrap">
      <header className="page-head">
        <p className="label">Developers</p>
        <h1 className="page-title">Build on the radar</h1>
        <p className="page-lede">
          Read-only, no key, no account. The API returns exactly the rows the
          site renders, so a consumer and a page reader can never see different
          numbers. The data is CC0; the code is MIT.
        </p>
      </header>

      <div className="prose" style={{ paddingTop: "2rem" }}>
        <h2>Quick start</h2>
      </div>

      <div className="panel dev-block">
        <pre className="mono dev-code">{`curl https://free-pool-radar.vercel.app/api/stats`}</pre>
        <p className="annot" style={{ marginTop: "0.75rem" }}>
          Every response uses the same envelope: <code>data</code> plus{" "}
          <code>generatedAt</code>, and where relevant <code>count</code>,{" "}
          <code>sources</code>, <code>lastSweepAt</code> and{" "}
          <code>nextSweepAt</code>. Timestamps are ISO 8601 UTC.
        </p>
      </div>

      <div className="prose" style={{ paddingTop: "2.5rem" }}>
        <h2>Endpoints</h2>
        <p>
          Nothing below requires authentication. Filter the change log with{" "}
          <code>?type=</code> and <code>?limit=</code>; unknown values are
          rejected with a <code>400</code> rather than silently ignored.
        </p>
      </div>

      <div className="tbl-wrap" style={{ marginTop: "1rem" }}>
        <table className="tbl">
          <caption>Public read endpoints</caption>
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">Path</th>
              <th scope="col">Returns</th>
              <th scope="col">Open</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={e.path}>
                <td className="mono">{e.method}</td>
                <td className="mono key">{e.path}</td>
                <td>{e.what}</td>
                <td>
                  <Link href={e.path} className="link-ev">
                    Try <span aria-hidden="true">→</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose" style={{ paddingTop: "2.5rem" }}>
        <h2>Status codes</h2>
        <ul>
          <li>
            <strong>200</strong> — success.
          </li>
          <li>
            <strong>400</strong> — an unknown filter value on{" "}
            <code>/api/changes</code>.
          </li>
          <li>
            <strong>503</strong> — the database is not configured, or a read
            failed. A failed read is never reported as an empty result: you get
            an explicit error, not a <code>200</code> with an empty array.
          </li>
        </ul>
        <p>
          Responses are cached for five minutes (<code>s-maxage=300</code>).
          Nothing changes between sweeps, so polling tighter than that only
          costs you requests.
        </p>

        <h2>Errors are not empty results</h2>
        <p>
          If a route you expected to be populated comes back{" "}
          <code>503</code>, the source could not be read. That is distinct from
          a genuinely empty set, and the two are never collapsed into each
          other — the same rule the site follows.
        </p>

        <h2>Go further</h2>
        <ul>
          <li>
            <Link href="/feed.xml">The Atom feed</Link> tells you when a new
            pool appears, a quota moves, or access is withdrawn.
          </li>
          <li>
            <Link href="/methodology">Methodology</Link> explains what qualifies
            as free, how claims are ranked, and why a failed source never ends
            an offer.
          </li>
          <li>
            <Link href="/timeline">The timeline</Link> is the full change
            history the API reads from.
          </li>
          <li>
            <Link href="/ecosystem">Ecosystem</Link> lists what people have
            built on top of the data.
          </li>
        </ul>
      </div>
    </main>
  );
}
