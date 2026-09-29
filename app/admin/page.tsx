import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";
import { getSources, getStatus } from "@/lib/db";
import { stampUTC } from "@/lib/format";

export const metadata: Metadata = {
  // An internal operational page: it must never be indexed.
  title: "Source health",
  robots: { index: false, follow: false },
};

/** Whether the admin routes may be rendered at all. */
export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_TOKEN);
}

/**
 * §50. Source health.
 *
 * Reachable without a token only when one is not configured, which is the local
 * development case. In production the route refuses to render rather than
 * relying on a hidden URL, a query parameter, or a password in the frontend
 * (§80) — those are not security controls.
 */
export default async function AdminPage() {
  if (process.env.NODE_ENV === "production" && !adminEnabled()) {
    return (
      <>
        <main id="main" className="wrap">
          <header className="page-head">
            <h1 className="page-title">Admin unavailable</h1>
            <p className="page-lede">
              This deployment has no <code>ADMIN_TOKEN</code> set, so the
              operational routes are disabled. Set one and redeploy to enable
              them.
            </p>
          </header>
        </main>
      </>
    );
  }

  const [sources, status] = await Promise.all([getSources(), getStatus()]);

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

          {sources.length === 0 ? (
            <EmptyState title="No sources registered">
              The source registry is empty. Add rows to the sources table to
              begin monitoring.
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
