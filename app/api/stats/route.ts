import { getLiveOffers, getModels, getProviders, getStatus } from "@/lib/db";
import { envelope, readErrorResponse } from "@/lib/publicData";
import { iso } from "@/lib/format";

export const revalidate = 300;

/**
 * GET /api/stats — headline counts (used by the README updater and badges).
 *
 * The counts are computed from the same reads the site uses, so a reader and
 * the README can never disagree. A failed read returns 503 rather than a row of
 * zeros: a zero is a fact, and this is not one.
 */
export async function GET() {
  const [
    { data: offers, error: offersError },
    { data: providers, error: providersError },
    { data: models, error: modelsError },
    { data: status, error: statusError },
  ] = await Promise.all([getLiveOffers(), getProviders(), getModels(), getStatus()]);

  if (offersError) return readErrorResponse("live offers");
  if (providersError) return readErrorResponse("providers");
  if (modelsError) return readErrorResponse("models");
  if (statusError) return readErrorResponse("source status");

  return envelope({
    freeRoutes: offers.length,
    providers: providers.length,
    models: models.length,
    ended: status?.offers_ended ?? null,
    upcoming: status?.offers_upcoming ?? null,
    sources: {
      total: status?.sources_total ?? null,
      ok: status?.sources_ok ?? null,
      impaired: status?.sources_unhealthy ?? null,
    },
    // The deterministic gate in the scheduler, not a decoration. See
    // supabase/migrations/0015_sweep_gate_tolerance.sql.
    verificationCycleHours: 5,
    lastSweepAt: iso(status?.last_sweep_at ?? null),
    nextSweepAt: iso(status?.next_sweep_at ?? null),
  });
}
