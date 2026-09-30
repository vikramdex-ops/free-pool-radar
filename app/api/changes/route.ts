import { getChanges } from "@/lib/db";
import { envelope, readErrorResponse } from "@/lib/publicData";
import { iso, stampUTC } from "@/lib/format";

export const revalidate = 300;

/**
 * GET /api/changes — the append-only change log (§7.6, §15).
 *
 * Supports `?type=` to filter on a single change type, and `?limit=` to bound
 * the response. Both are validated rather than interpolated, so a caller
 * cannot inject anything.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");

  // A nonsense limit falls back to the default rather than erroring: an API
  // consumer asking badly should still get data.
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(500, Math.trunc(rawLimit)))
    : 100;

  const VALID = new Set([
    "new", "model_added", "model_removed",
    "quota_increased", "quota_decreased",
    "pool_started", "pool_exhausted", "pool_extended", "pool_cancelled",
    "price_changed", "card_required", "card_removed",
    "subscription_required", "subscription_removed",
    "free_tier_started", "free_tier_ended",
    "rate_limit_changed", "status_changed",
  ]);

  if (type !== null && !VALID.has(type)) {
    return Response.json(
      {
        error: "invalid_type",
        message: `Unknown change type. Valid values: ${[...VALID].sort().join(", ")}`,
      },
      { status: 400 },
    );
  }

  const { data: all, error: changesError } = await getChanges(limit);
  if (changesError) return readErrorResponse("changes");
  const rows = type ? all.filter((c) => c.change_type === type) : all;

  return envelope(
    rows.map((c) => ({
      id: c.id,
      provider: c.provider?.name ?? null,
      providerSlug: c.provider?.slug ?? null,
      changeType: c.change_type,
      field: c.field,
      oldValue: c.old_value,
      newValue: c.new_value,
      severity: c.severity,
      detectedAt: iso(c.detected_at),
      detectedDisplay: stampUTC(c.detected_at),
      sourceUrl: c.source_url,
      evidence: c.evidence,
    })),
    { count: rows.length, filter: { type, limit } },
  );
}
