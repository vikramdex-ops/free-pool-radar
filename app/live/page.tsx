import type { Metadata } from "next";
import { LiveBrowser } from "@/components/LiveBrowser";
import { getLiveOffers, getStatus } from "@/lib/db";
import { stampUTC } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Live free AI access",
  description:
    "Every currently usable free AI inference route, filterable by access type, keyless availability, card and subscription requirement, model family and OpenAI or Anthropic API compatibility.",
  alternates: { canonical: "/live" },
};

/** §21. The complete live set, with the filter set applied client-side. */
export default async function LivePage() {
  const now = Date.now();
  const [offers, status] = await Promise.all([getLiveOffers(), getStatus()]);

  return (
    <main id="main" className="wrap">
      <header className="page-head">
        <p className="label">Live now</p>
        <h1 className="page-title">Free access right now</h1>
        <p className="page-lede">
          Every route currently usable at no cost, with the terms that apply to
          it. Filters are facts, not a ranking: choosing &ldquo;no card&rdquo;
          tells you which offers need no payment method, and choosing
          &ldquo;anthropic compatible&rdquo; tells you which speak that
          dialect. Nothing here is scored.
        </p>
        <p className="annot mono" style={{ marginTop: "0.875rem" }}>
          Last sweep {stampUTC(status?.last_sweep_at ?? null) ?? "not yet run"} ·
          next {stampUTC(status?.next_sweep_at ?? null) ?? "not scheduled"} ·{" "}
          {status?.sources_ok ?? 0}/{status?.sources_total ?? 0} sources
          responding
        </p>
      </header>

      <div className="sect" style={{ paddingTop: "1.5rem" }}>
        <LiveBrowser offers={offers} now={now} />
      </div>
    </main>
  );
}
