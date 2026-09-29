import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { getModels } from "@/lib/db";
import { num } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Model index",
  description:
    "Searchable index of every model found on a free AI inference route, with the provider serving it, its access type, status, limits and last verification time.",
  alternates: { canonical: "/models" },
};

/**
 * §25. A searchable model database.
 *
 * Rendered as a full table with a client-side filter rather than a paginated
 * server query: the dataset is small enough to ship whole, and filtering
 * instantly is worth more here than trimming the payload.
 */
export default async function ModelsPage() {
  const models = await getModels();
  return (
    <>
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">Index</p>
          <h1 className="page-title">Model index</h1>
          <p className="page-lede">
            Every model found on a free route we monitor. A model appearing here
            means it was seen on a free endpoint, not that the model is free
            everywhere &mdash; check the provider and the terms on its own page.
          </p>
        </header>

        <div className="sect" style={{ paddingTop: 0 }}>
          {models.length === 0 ? (
            <EmptyState title="No models recorded">
              No model has been recorded yet. The first monitoring sweep fills
              this index from provider catalogues.
            </EmptyState>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <caption>{models.length} models on free routes</caption>
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    <th scope="col">Model id</th>
                    <th scope="col">Context</th>
                    <th scope="col">Capabilities</th>
                    <th scope="col">First seen</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/models/${m.slug}`} className="link key">
                          {m.display_name}
                        </Link>
                      </td>
                      <td className="num">{m.model_id}</td>
                      <td className="num">
                        {m.context_window ? num(m.context_window) : "—"}
                      </td>
                      <td>
                        {m.capabilities.length ? m.capabilities.join(", ") : "—"}
                      </td>
                      <td className="num">
                        {new Date(m.first_seen_at).toISOString().slice(0, 10)}
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
