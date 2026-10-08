import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ecosystem",
  description:
    "Projects built on Free Pool Radar: the public API, open datasets, Atom feed and MCP server, plus community tools you can add.",
  alternates: { canonical: "/ecosystem" },
};

/**
 * The ecosystem page.
 *
 * It lists what exists and what is wanted. Nothing here is fabricated: a
 * "shipped" surface is one that returns data on this deployment, and a "wanted"
 * row is a scoped invitation, not a claim that someone has built it. Projects
 * are grouped by kind, never ordered by popularity — the same rule the rest of
 * the project follows.
 */

interface Surface {
  name: string;
  type: string;
  status: "shipped" | "wanted";
  href?: string;
  note: string;
}

const FIRST_PARTY: Surface[] = [
  {
    name: "Free Pool Radar API",
    type: "REST",
    status: "shipped",
    href: "/api/live",
    note: "Read-only, no key. Every endpoint the site renders.",
  },
  {
    name: "Free Pool Radar datasets",
    type: "JSON / CSV",
    status: "shipped",
    href: "/api/dataset",
    note: "The whole dataset in one document, or flattened to CSV.",
  },
  {
    name: "Free Pool Radar feed",
    type: "Atom",
    status: "shipped",
    href: "/feed.xml",
    note: "New pools, quota changes and withdrawals as a subscribable feed.",
  },
  {
    name: "Free Pool Radar MCP",
    type: "MCP server",
    status: "shipped",
    note: "Query live free routes from a coding agent. See MCP.md in the repository.",
  },
];

const COMMUNITY: Surface[] = [
  { name: "FreePool CLI", type: "CLI", status: "wanted", note: "Query free routes from a terminal: freepool --model reasoning" },
  { name: "Free Pool Discord bot", type: "Bot", status: "wanted", note: "Announce a new pool the moment the feed shows one" },
  { name: "Free AI Finder", type: "Browser extension", status: "wanted", note: "Surface a free route while reading a provider's docs" },
  { name: "Free Pool Telegram bot", type: "Bot", status: "wanted", note: "The same announcements, for Telegram" },
  { name: "Radar newsletter", type: "Newsletter", status: "wanted", note: "A weekly digest built from /api/changes" },
];

function Row({ p }: { p: Surface }) {
  return (
    <tr>
      <td className="key">
        {p.href ? <Link href={p.href}>{p.name}</Link> : p.name}
      </td>
      <td>{p.type}</td>
      <td>
        <span className={`badge ${p.status === "shipped" ? "badge-live" : "badge-upcoming"}`}>
          {p.status === "shipped" ? "shipped" : "wanted"}
        </span>
      </td>
      <td>{p.note}</td>
    </tr>
  );
}

export default function EcosystemPage() {
  return (
    <main id="main" className="wrap">
      <header className="page-head">
        <p className="label">Built on Free Pool Radar</p>
        <h1 className="page-title">Ecosystem</h1>
        <p className="page-lede">
          Free Pool Radar is meant to be built on. The API, the datasets, the
          feed and the MCP server are all open, and the data is CC0. This page
          lists what exists and what is wanted.
        </p>
      </header>

      <div className="prose" style={{ paddingTop: "2rem" }}>
        <h2>First-party surfaces</h2>
        <p>
          These ship with the project and are available on any deployment,
          including your own fork.
        </p>
      </div>

      <div className="tbl-wrap" style={{ marginTop: "1rem" }}>
        <table className="tbl">
          <caption>Surfaces that ship with the radar</caption>
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">What it does</th>
            </tr>
          </thead>
          <tbody>
            {FIRST_PARTY.map((p) => (
              <Row key={p.name} p={p} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose" style={{ paddingTop: "2.5rem" }}>
        <h2>Community — wanted</h2>
        <p>
          These are scoped, self-contained projects. If you build one, open a
          pull request adding it below and to <code>ECOSYSTEM.md</code>.
        </p>
      </div>

      <div className="tbl-wrap" style={{ marginTop: "1rem" }}>
        <table className="tbl">
          <caption>Projects Free Pool Radar would like to see</caption>
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Idea</th>
            </tr>
          </thead>
          <tbody>
            {COMMUNITY.map((p) => (
              <Row key={p.name} p={p} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose" style={{ paddingTop: "2.5rem" }}>
        <h2>Add your project</h2>
        <p>
          If it uses the radar — a client, a bot, a dataset analysis, a
          frontend, a mirror — open a pull request editing{" "}
          <code>ECOSYSTEM.md</code> and this page. Include a name, a type, a
          link and one honest sentence. No ranking, no affiliate links.
        </p>
        <p>
          Building blocks: <Link href="/api/live">the API</Link>,{" "}
          <Link href="/api/dataset">the dataset</Link>, the{" "}
          <a href="/feed.xml">Atom feed</a>, and the repository&rsquo;s{" "}
          <code>mcp/</code> directory.
        </p>
      </div>
    </main>
  );
}
