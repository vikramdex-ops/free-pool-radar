import type { Metadata } from "next";
import { LiveBrowser } from "@/components/LiveBrowser";
import { ReadError } from "@/components/ui";
import { getChanges, getLiveOffers, getStatus } from "@/lib/db";
import { stampUTC } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Live free AI access",
  description:
    "Usable free AI routes now, filterable by provider, model, keyless access, card rules, limits, freshness and API compatibility.",
  alternates: { canonical: "/live" },
};

/** §21, §31, §32. The complete live set with the filter and sort system. */
export default async function LivePage() {
  const now = Date.now();
  // Changes are fetched because "recently changed" (§32) cannot be derived from
  // the offer row: that holds current state, not when it last moved.
  const [
    { data: offers, error: offersError },
    { data: changes, error: changesError },
    { data: status, error: statusError },
  ] = await Promise.all([getLiveOffers(), getChanges(500), getStatus()]);

  return (
    <main id="main" className="wrap">
      <header className="page-head">
        <p className="label">Live now</p>
        <h1 className="page-title">Free access right now</h1>
        <p className="page-lede">
          Every route currently usable at no cost, with the terms that apply to
          it. Filters are facts, not a ranking: choosing &ldquo;anthropic
          compatible&rdquo; tells you which speak that dialect, and choosing
          &ldquo;no card&rdquo; confirms what holds across the whole market at
          present &mdash; every tracked route needs no payment method and no
          subscription, so those two pills confirm rather than narrow. Nothing
          here is scored.
        </p>
        <p className="annot mono" style={{ marginTop: "0.875rem" }}>
          {statusError ? (
            <>Source status could not be read.</>
          ) : (
            <>
              Last sweep {stampUTC(status?.last_sweep_at ?? null) ?? "not yet run"} · next{" "}
              {stampUTC(status?.next_sweep_at ?? null) ?? "not scheduled"} ·{" "}
              {status?.sources_ok ?? 0}/{status?.sources_total ?? 0} sources
              responding
            </>
          )}
        </p>
      </header>

      <div className="sect" style={{ paddingTop: "1.5rem" }}>
        {offersError || changesError ? (
          <ReadError what="Live routes" />
        ) : (
          <LiveBrowser offers={offers} changes={changes} now={now} />
        )}
      </div>
    </main>
  );
}
