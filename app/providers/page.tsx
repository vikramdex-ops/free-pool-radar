import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Registry } from "@/components/Registry";
import { getProviders } from "@/lib/db";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Provider index",
  description:
    "Providers tracked for free AI access: pools, tiers, sponsored routes and withdrawn offers, with card rules and verification history.",
  alternates: { canonical: "/providers" },
};

/** §26. The index of provider pages. */
export default async function ProvidersPage() {
  const providers = await getProviders();
  return (
    <>
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">Index</p>
          <h1 className="page-title">Providers</h1>
          <p className="page-lede">
            Every provider this radar knows about, whether it currently offers
            free access or not. Listed alphabetically, never ranked &mdash; the
            figures are there so you can decide, not so we can tell you who
            wins.
          </p>
        </header>

        <div className="sect" style={{ paddingTop: 0 }}>
          <Registry providers={providers} />
        </div>
      </main>
    </>
  );
}
