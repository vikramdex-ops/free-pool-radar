import { getLiveOffers, isConfigured } from "@/lib/db";
import { notConfiguredResponse, readErrorResponse } from "@/lib/publicData";
import { iso } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * GET /data/latest.csv — the live offer set, one row per offer.
 *
 * Column definitions are in DATASET.md. Empty cells mean "not publicly stated",
 * not zero — the CSV carries the same honesty as the API.
 */

const COLUMNS = [
  "id",
  "provider",
  "provider_slug",
  "model",
  "model_id",
  "status",
  "offer_type",
  "card_required",
  "payment_required",
  "api_key_required",
  "keyless",
  "rpm",
  "rpd",
  "tpm",
  "tpd",
  "pool_size",
  "pool_remaining",
  "pool_unit",
  "credit_amount",
  "credit_currency",
  "start_at",
  "end_at",
  "verification_level",
  "official_evidence_url",
  "last_verified_at",
  "provenance",
] as const;

/** RFC 4180 quoting: quote when the value contains a delimiter, quote or newline. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!isConfigured()) return notConfiguredResponse();

  const { data: offers, error } = await getLiveOffers();
  if (error) return readErrorResponse("live offers");

  const rows: string[] = [COLUMNS.join(",")];
  for (const o of offers) {
    rows.push(
      [
        o.id,
        o.provider?.name ?? null,
        o.provider?.slug ?? null,
        o.model_label,
        o.model_id_text,
        o.status,
        o.offer_type,
        o.card_required,
        o.payment_required,
        o.api_key_required,
        o.keyless,
        o.rpm,
        o.rpd,
        o.tpm,
        o.tpd,
        o.pool_size,
        o.pool_remaining,
        o.pool_unit,
        o.credit_amount,
        o.credit_currency,
        iso(o.start_at),
        iso(o.end_at),
        o.verification_level,
        o.official_evidence_url,
        iso(o.last_verified_at),
        o.is_seed_data ? "researched" : "observed",
      ]
        .map(cell)
        .join(","),
    );
  }

  return new Response(`${rows.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="free-pool-radar-latest.csv"',
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
