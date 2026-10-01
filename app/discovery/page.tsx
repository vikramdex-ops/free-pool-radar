import type { Metadata } from "next";
import Link from "next/link";
import { adminClient } from "@/lib/admin-db";
import { ago, stampUTC } from "@/lib/format";
import { signOut } from "@/app/admin/login/actions";
import { resolveCandidate } from "./actions";

export const metadata: Metadata = {
  // §52 marks this internal only. It is behind authentication, and it must
  // never appear in a search result either.
  title: "Discovery queue",
  robots: { index: false, follow: false },
};

// The queue changes only when a reviewer acts, and it must never be baked into
// a build artifact: a prerendered copy would show one reviewer's decisions to
// the next person who signs in.
export const dynamic = "force-dynamic";

interface Candidate {
  id: number;
  url: string;
  provider_guess: string | null;
  note: string | null;
  discovered_from: string | null;
  discovered_at: string;
  status: string;
  kind: string | null;
  evidence: string | null;
  resolution_note: string | null;
  reviewed_at: string | null;
  ai_summary: string | null;
  ai_confidence: number | null;
  ai_rationale: string | null;
}

interface Decision {
  id: number;
  candidate_id: number;
  from_status: string | null;
  to_status: string;
  note: string | null;
  decided_at: string;
}

const KIND_LABEL: Record<string, string> = {
  new_provider: "Potential provider",
  free_model: "Potential free model",
  shared_pool: "Potential shared pool",
  ended_offer: "Potential ended offer",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Unreviewed",
  investigating: "Investigating",
  verified: "Verified",
  rejected: "Rejected",
  merged: "Merged",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "badge-stale",
  investigating: "badge-info",
  verified: "badge-live",
  rejected: "badge-ended",
  merged: "badge-upcoming",
};

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const client = adminClient();
  // The middleware has already established who is asking. If the elevated
  // credential is missing, say so plainly rather than rendering an empty queue,
  // which would look identical to "there is nothing to review".
  if (!client) {
    return (
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">Internal</p>
          <h1 className="page-title">Discovery queue</h1>
          <p className="page-lede">
            No server-side database credential is configured on this
            deployment, so the review queue cannot be read.
          </p>
        </header>
      </main>
    );
  }

  const wantStatus = params.status && STATUS_LABEL[params.status] ? params.status : null;
  const wantKind = params.kind && KIND_LABEL[params.kind] ? params.kind : null;

  let query = client
    .from("discovery_candidates")
    .select("*")
    .order("discovered_at", { ascending: false })
    .order("id", { ascending: false });
  if (wantStatus) query = query.eq("status", wantStatus);
  if (wantKind) query = query.eq("kind", wantKind);

  const [{ data, error }, decisionsRes] = await Promise.all([
    query,
    client
      .from("discovery_candidate_decisions")
      .select("id,candidate_id,from_status,to_status,note,decided_at")
      .order("decided_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(80),
  ]);

  const candidates = (data ?? []) as Candidate[];
  const now = Date.now();
  const decisions = (decisionsRes.data ?? []) as Decision[];

  // The decision log, indexed so each candidate can show its full review
  // history without a second round trip per row.
  const byCandidate = new Map<number, Decision[]>();
  for (const d of decisions) {
    const list = byCandidate.get(d.candidate_id) ?? [];
    list.push(d);
    byCandidate.set(d.candidate_id, list);
  }

  const counts = {
    pending: candidates.filter((c) => c.status === "pending").length,
    investigating: candidates.filter((c) => c.status === "investigating").length,
    verified: candidates.filter((c) => c.status === "verified").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
  };

  return (
    <main id="main" className="wrap">
      <header className="page-head">
        <p className="label">Internal</p>
        <h1 className="page-title">Discovery queue</h1>
        <p className="page-lede">
          Leads that may be worth tracking. Nothing here is published and
          nothing here is treated as an offer — a candidate becomes an offer
          only after someone verifies it against a source, and says why.
        </p>
        <div className="admin-bar">
          <Link href="/admin" className="link-ev">
            Source health <span aria-hidden="true">→</span>
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn btn-quiet">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Filters. Deliberately links rather than a client component: the queue is
          small, and a reload costs less than shipping the whole set to hydrate
          four buttons. */}
      <nav className="filter-bar" aria-label="Filter the discovery queue">
        <Link
          href="/discovery"
          className={`filter ${!wantStatus && !wantKind ? "filter-on" : ""}`}
          aria-current={!wantStatus && !wantKind ? "page" : undefined}
        >
          All
        </Link>
        {(["pending", "investigating", "verified", "rejected"] as const).map(
          (s) => (
            <Link
              key={s}
              href={`/discovery?status=${s}`}
              className={`filter ${wantStatus === s ? "filter-on" : ""}`}
              aria-current={wantStatus === s ? "page" : undefined}
            >
              {STATUS_LABEL[s]} ({counts[s]})
            </Link>
          ),
        )}
        <span className="filter-sep" aria-hidden="true" />
        {Object.entries(KIND_LABEL).map(([k, label]) => (
          <Link
            key={k}
            href={`/discovery?kind=${k}`}
            className={`filter ${wantKind === k ? "filter-on" : ""}`}
            aria-current={wantKind === k ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className="empty">
          <p className="empty-title">The queue could not be read</p>
          <p>{error.message}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Nothing to review</p>
          <p>
            No candidate matches this filter. That is the queue being empty,
            not the queue failing to load.
          </p>
        </div>
      ) : (
        <ul className="cand-list">
          {candidates.map((c) => {
            const history = byCandidate.get(c.id) ?? [];
            return (
              <li key={c.id} className="panel cand">
                <div className="cand-head">
                  <div>
                    <p className="label">
                      {c.kind ? KIND_LABEL[c.kind] : "Unclassified"}
                    </p>
                    <h2 className="cand-title">
                      {c.provider_guess ?? "Unnamed lead"}
                    </h2>
                  </div>
                  <span className={`badge ${STATUS_CLASS[c.status] ?? "badge-stale"}`}>
                    <span className="dot" aria-hidden="true" />
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>

                <dl className="cand-facts">
                  <div>
                    <dt className="label">URL</dt>
                    <dd>
                      <a
                        href={c.url}
                        className="link-ev"
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        {c.url} <span aria-hidden="true">→</span>
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Found</dt>
                    <dd className="mono">
                      {stampUTC(c.discovered_at)}{" "}
                      <span className="annot">({ago(c.discovered_at, now)})</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Discovered from</dt>
                    <dd>{c.discovered_from ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="label">Evidence</dt>
                    <dd>{c.evidence ?? c.note ?? "—"}</dd>
                  </div>
                </dl>

                {/* §52 asks for an AI classification on every candidate. Where
                    one has not been produced, that is stated rather than
                    replaced by the note standing in for it. */}
                <div className="cand-ai">
                  <p className="label">AI classification</p>
                  {c.ai_summary || c.ai_rationale ? (
                    <>
                      <p className="cand-ai-text">
                        {c.ai_summary ?? c.ai_rationale}
                      </p>
                      {c.ai_confidence !== null ? (
                        <p className="annot mono">
                          stated confidence{" "}
                          {(c.ai_confidence * 100).toFixed(0)}%
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="annot">
                      Not classified. The research agent has not assessed this
                      candidate, so nothing here is a machine judgement.
                    </p>
                  )}
                </div>

                {/* The full review history, because a single note cannot show
                    that a candidate was rejected, reopened, and rejected again
                    for a different reason. */}
                {history.length > 0 ? (
                  <details className="cand-history">
                    <summary>
                      {history.length} decision{history.length === 1 ? "" : "s"} on
                      record
                    </summary>
                    <ol className="cand-decisions">
                      {history.map((d) => (
                        <li key={d.id}>
                          <span className="mono annot">
                            {stampUTC(d.decided_at)}
                          </span>{" "}
                          <span className="strong">
                            {d.from_status
                              ? `${STATUS_LABEL[d.from_status] ?? d.from_status} → ${STATUS_LABEL[d.to_status] ?? d.to_status}`
                              : STATUS_LABEL[d.to_status] ?? d.to_status}
                          </span>
                          {d.note ? <p className="annot">{d.note}</p> : null}
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}

                {/* §52's four actions. Verify and reject require a reason, so
                    their note field is not optional. */}
                <form action={resolveCandidate} className="cand-actions">
                  <input type="hidden" name="candidate_id" value={c.id} />
                  <label className="sr-only" htmlFor={`note-${c.id}`}>
                    Decision note for {c.provider_guess ?? `candidate ${c.id}`}
                  </label>
                  <input
                    id={`note-${c.id}`}
                    name="note"
                    className="cand-note"
                    placeholder={
                      c.status === "pending" || c.status === "investigating"
                        ? "Note (required to verify or reject)"
                        : "Note"
                    }
                  />
                  <div className="cand-buttons">
                    <button
                      type="submit"
                      name="status"
                      value="investigating"
                      className="btn btn-quiet"
                    >
                      Investigate
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="merged"
                      className="btn btn-quiet"
                    >
                      Merge
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="rejected"
                      className="btn btn-quiet btn-danger"
                    >
                      Reject
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="verified"
                      className="btn btn-primary"
                    >
                      Verify
                    </button>
                  </div>
                  <p className="annot">
                    Verifying or rejecting requires a note. Merging needs a
                    destination recorded on the candidate row, so use it once
                    the provider or offer exists.
                  </p>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
