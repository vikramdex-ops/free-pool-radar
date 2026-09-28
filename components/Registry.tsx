import Link from "next/link";
import type { Provider } from "@/lib/db";
import { num } from "@/lib/format";
import { EmptyState } from "./ui";

/**
 * The provider index (§26, §7.1).
 *
 * Providers are listed alphabetically, not ranked. A free model count is shown
 * because it is a fact, but nothing here implies one provider is better than
 * another (§57).
 */
export function Registry({ providers }: { providers: Provider[] }) {
  if (providers.length === 0) {
    return (
      <EmptyState title="No providers recorded">
        No provider has been added to the registry yet.
      </EmptyState>
    );
  }

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <caption>{providers.length} providers tracked</caption>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">Type</th>
            <th scope="col">Country</th>
            <th scope="col">Free model ids</th>
            <th scope="col">Live offers</th>
            <th scope="col">Status</th>
            <th scope="col">Official site</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/providers/${p.slug}`} className="link key">
                  {p.name}
                </Link>
                {p.description ? (
                  <p className="annot" style={{ marginTop: "0.25rem", maxWidth: "46ch" }}>
                    {p.description}
                  </p>
                ) : null}
              </td>
              <td>{p.provider_type ?? <span className="annot">Not stated</span>}</td>
              <td>{p.country ?? <span className="annot">Not stated</span>}</td>
              <td className="num">
                {p.free_model_count > 0 ? num(p.free_model_count) : "—"}
              </td>
              <td className="num">
                {p.live_offer_count > 0 ? num(p.live_offer_count) : "—"}
              </td>
              <td>
                <span
                  className={`badge ${
                    p.status === "active"
                      ? "badge-live"
                      : p.status === "shut_down"
                        ? "badge-ended"
                        : "badge-stale"
                  }`}
                >
                  {p.status.replace("_", " ").toUpperCase()}
                </span>
              </td>
              <td>
                <a
                  href={p.official_url}
                  className="link-ev"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  Official <span aria-hidden="true">→</span>
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
