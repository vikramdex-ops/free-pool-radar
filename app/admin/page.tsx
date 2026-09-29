import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { getStatus } from "@/lib/db";
import { getSourcesAdmin } from "@/lib/admin-db";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { stampUTC } from "@/lib/format";
import { signOut } from "./login/actions";

export const metadata: Metadata = {
  // An internal operational page: it must never be indexed.
  title: "Source health",
  robots: { index: false, follow: false },
};

/**
 * Never prerender this page.
 *
 * It reports live source health, so a build-time snapshot is wrong by
 * definition. Worse, the middleware guards the route but does not opt the page
 * into dynamic rendering, so without this Next prerendered it during the build
 * — with no credentials present — and served that frozen HTML indefinitely. The
 * page said "no server-side database credential is configured" and "the source
 * registry is empty" while twelve sources were registered and answering.
 *
 * The read of the session below is deliberate as well as the directive: it
 * ties the render to the request, so a future edit that drops this line still
 * cannot produce a cached copy of an authenticated page.
 */
export const dynamic = "force-dynamic";

async function assertSession(): Promise<void> {
  const store = await cookies();
  const ok = await verifySessionToken(store.get(ADMIN_COOKIE)?.value);
  // Defence in depth. The middleware has already refused an unauthenticated
  // request, so reaching this without a valid token means the gate and the page
  // have drifted apart, and the page must not be the one that quietly allows it.
  if (!ok) redirect("/admin/login");
}

/**
 * §50. Source health.
 *
 * Access control is checked here as well as in the middleware, not instead of
 * it. The middleware is the gate; this is the second lock on the same door, and
 * it is what stops the page from being rendered at all for an anonymous reader.
 */
export default async function AdminPage() {
  await assertSession();

  // The registry is read with the elevated client. The public read path is
  // subject to RLS and returns an empty list rather than an error, which would
  // make this page report an empty registry while sources are registered.
  const [{ data: sources, error: sourcesError }, status] = await Promise.all([
    getSourcesAdmin(),
    getStatus(),
  ]);

  return (
    <>
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">Internal</p>
          <h1 className="page-title">Source health</h1>
          <p className="page-lede">
            What the monitoring pipeline can currently see. A source that is not
            responding does not end its offers; those offers simply stop being
            re-verified and go stale on their own.
          </p>
          <div className="admin-bar">
            <Link href="/discovery" className="link-ev">
              Discovery queue <span aria-hidden="true">→</span>
            </Link>
            <form action={signOut}>
              <button type="submit" className="btn btn-quiet">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className="sect" style={{ paddingTop: 0 }}>
          <dl className="facts">
            <div>
              <dt className="label">Last sweep</dt>
              <dd className="mono">{stampUTC(status?.last_sweep_at ?? null) ?? "Never"}</dd>
            </div>
            <div>
              <dt className="label">Next sweep</dt>
              <dd className="mono">{stampUTC(status?.next_sweep_at ?? null) ?? "Not scheduled"}</dd>
            </div>
            <div>
              <dt className="label">Last run finished</dt>
              <dd className="mono">
                {stampUTC(status?.last_finished_at ?? null) ?? "Never"}
              </dd>
            </div>
            <div>
              <dt className="label">Last run duration</dt>
              <dd className="mono">
                {status?.last_duration_ms != null
                  ? `${(status.last_duration_ms / 1000).toFixed(1)}s`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="label">Sources</dt>
              <dd className="mono">
                {status?.sources_ok ?? 0} / {status?.sources_total ?? 0}
              </dd>
            </div>
            <div>
              <dt className="label">Pending candidates</dt>
              <dd className="mono">{status?.candidates_pending ?? 0}</dd>
            </div>
          </dl>

          {sourcesError ? (
            /* A read that failed is not an empty registry. Saying so plainly is
               the whole point of an operational page. */
            <div className="empty">
              <p className="empty-title">The registry could not be read</p>
              <p>
                This is a read failure, not an empty registry — the source rows
                may well be there. {sourcesError}
              </p>
            </div>
          ) : sources.length === 0 ? (
            <EmptyState title="No sources registered">
              The source registry is genuinely empty. Add rows to the sources
              table to begin monitoring.
            </EmptyState>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <caption>{sources.length} registered sources</caption>
                <thead>
                  <tr>
                    <th scope="col">Provider</th>
                    <th scope="col">Health</th>
                    <th scope="col">Status</th>
                    <th scope="col">Latency</th>
                    <th scope="col">Last OK</th>
                    <th scope="col">Parser</th>
                    <th scope="col">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id}>
                      <td className="key">{s.provider_slug}</td>
                      <td>
                        <span
                          className={`badge ${
                            s.health === "live"
                              ? "badge-live"
                              : s.health === "slow"
                                ? "badge-info"
                                : s.health === "disabled"
                                  ? "badge-stale"
                                  : "badge-ended"
                          }`}
                        >
                          <span className="dot" aria-hidden="true" />
                          {s.health.toUpperCase()}
                        </span>
                      </td>
                      <td className="num">{s.last_status_code ?? "—"}</td>
                      <td className="num">
                        {s.last_latency_ms != null ? `${s.last_latency_ms}ms` : "—"}
                      </td>
                      <td className="num">{stampUTC(s.last_ok_at) ?? "Never"}</td>
                      <td className="mono">{s.parser_key}</td>
                      <td>
                        {s.last_error ? (
                          <span className="annot" style={{ color: "var(--t-ended)" }}>
                            {s.last_error}
                          </span>
                        ) : (
                          <a
                            href={s.url}
                            className="link-ev"
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                          >
                            Source <span aria-hidden="true">→</span>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
