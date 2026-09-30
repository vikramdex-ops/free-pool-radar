import { NextResponse } from "next/server";
import {
  getEndedOffers,
  getEvents,
  getLiveOffers,
  getStatus,
  getUpcomingOffers,
  isConfigured,
  type OfferWithProvider,
} from "@/lib/db";
import { iso, stampUTC } from "@/lib/format";

/**
 * Public API shape (§37).
 *
 * Every response is built from the same stored rows the website renders, so an
 * API consumer and a page reader can never see different numbers. Timestamps
 * are ISO 8601; the editorial forms stay on the site (§74).
 *
 * `publicData` is deliberately read-only and uses the publishable key, so these
 * routes need no authentication and expose nothing the site does not already
 * show.
 */

export const revalidate = 300;

/** The documented per-offer shape, with evidence attached. */
export function serialiseOffer(o: OfferWithProvider) {
  return {
    id: o.id,
    provider: o.provider?.name ?? null,
    providerSlug: o.provider?.slug ?? null,
    providerUrl: o.provider?.official_url ?? null,
    model: o.model_label,
    modelId: o.model_id_text,
    status: o.status,
    offerType: o.offer_type,

    cardRequired: o.card_required,
    paymentRequired: o.payment_required,
    subscriptionRequired: o.access_requires_subscription,
    apiKeyRequired: o.api_key_required,
    keyless: o.keyless,

    compatibility: {
      openai: o.compatibility_openai,
      anthropic: o.compatibility_anthropic,
      other: o.compatibility_other,
    },

    limits: {
      rpm: o.rpm,
      rpd: o.rpd,
      tpm: o.tpm,
      tpd: o.tpd,
      monthlyLimit: o.monthly_limit,
      monthlyUnit: o.monthly_unit,
      tokenLimit: o.token_limit,
      tokenLimitUnit: o.token_limit_unit,
    },

    pool: o.pool_size === null && o.pool_remaining === null ? null : {
      size: o.pool_size,
      remaining: o.pool_remaining,
      unit: o.pool_unit,
    },

    credit:
      o.credit_amount === null
        ? null
        : { amount: o.credit_amount, currency: o.credit_currency },

    startAt: iso(o.start_at),
    endAt: iso(o.end_at),
    exhaustionCondition: o.exhaustion_condition,

    commercialUse: o.commercial_use,
    dataPolicy: o.data_policy,
    retentionPolicy: o.retention_policy,

    verificationLevel: o.verification_level,
    officialEvidenceUrl: o.official_evidence_url,
    secondaryEvidenceUrl: o.secondary_evidence_url,

    firstDiscoveredAt: iso(o.first_discovered_at),
    firstVerifiedAt: iso(o.first_verified_at),
    lastVerifiedAt: iso(o.last_verified_at),
    lastVerifiedDisplay: stampUTC(o.last_verified_at),
    endedAt: iso(o.ended_at),

    provenance: o.is_seed_data ? "researched" : "observed",
  };
}

/** Standard envelope: the data, plus when it was produced and from where. */
export function envelope(
  data: unknown,
  extra: Record<string, unknown> = {},
): NextResponse {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "The database is not configured on this deployment. See .env.example.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json(
    {
      data,
      generatedAt: new Date().toISOString(),
      ...extra,
    },
    {
      headers: {
        // Public and briefly cacheable: the underlying data only changes every
        // five hours (§77), so a short cache costs nothing and keeps the origin
        // cheap.
        //
        // `stale-while-revalidate` is deliberately short. A long SWR window
        // compounds with the ISR revalidation interval, so a change could take
        // ten minutes to appear even though the collector writes it
        // immediately — which would make the site look like it had missed an
        // update it had actually recorded.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}

/** A failed read is never rendered as an empty result (LED-001, invariant 9).
 *  API consumers get an explicit error status rather than a 200 with []. */
export function readErrorResponse(what: string): NextResponse {
  return NextResponse.json(
    {
      error: "read_failed",
      message: `The ${what} could not be read. This is a read failure, not an empty result.`,
    },
    { status: 503 },
  );
}

type StatusRow = NonNullable<Awaited<ReturnType<typeof getStatus>>["data"]>;

const statusMetaFrom = (s: StatusRow | null) =>
  s
    ? {
        sources: { total: s.sources_total, ok: s.sources_ok, impaired: s.sources_unhealthy },
        lastSweepAt: iso(s.last_sweep_at),
        nextSweepAt: iso(s.next_sweep_at),
      }
    : {};

/* ------------------------------------------------------------------ */
/* shared query builders                                               */
/* ------------------------------------------------------------------ */

export async function livePayload() {
  // The reads are independent, so they go out together: on a serverless
  // function each Supabase roundtrip costs real network time, and sequential
  // awaits make them additive (PUL-006). Order is unaffected — each query
  // keeps its own ORDER BY and the arrays are never interleaved. Every read
  // is checked, so a failure surfaces as 503 instead of an empty table.
  const [{ data: offers, error: offersError }, { data: status, error: statusError }] =
    await Promise.all([getLiveOffers(), getStatus()]);
  if (offersError) return readErrorResponse("live offers");
  if (statusError) return readErrorResponse("source status");
  return envelope(offers.map(serialiseOffer), {
    count: offers.length,
    ...statusMetaFrom(status),
  });
}

export async function upcomingPayload() {
  // Same as above: three independent reads, one network wait instead of
  // three. Offers and events stay in separate arrays in fixed positions,
  // so no two records with the same sort key can interleave — invariant 1
  // (never rank, missing values last) is preserved by construction.
  const [
    { data: offers, error: offersError },
    { data: events, error: eventsError },
    { data: status, error: statusError },
  ] = await Promise.all([getUpcomingOffers(), getEvents(), getStatus()]);
  if (offersError) return readErrorResponse("upcoming offers");
  if (eventsError) return readErrorResponse("events");
  if (statusError) return readErrorResponse("source status");
  return envelope(
    {
      offers: offers.map(serialiseOffer),
      events: events.map((e) => ({
        id: e.id,
        slug: e.slug,
        name: e.name,
        provider: e.provider?.name ?? null,
        providerSlug: e.provider?.slug ?? null,
        status: e.status,
        startAt: iso(e.start_at),
        endAt: iso(e.end_at),
        poolSize: e.pool_size,
        poolRemaining: e.pool_remaining,
        unit: e.unit,
        models: e.models,
        requirements: e.requirements,
        exhaustionCondition: e.exhaustion_condition,
        officialUrl: e.official_url,
        lastVerifiedAt: iso(e.last_verified_at),
      })),
    },
    { count: offers.length, ...statusMetaFrom(status) },
  );
}

export async function endedPayload() {
  const { data: offers, error: offersError } = await getEndedOffers();
  if (offersError) return readErrorResponse("ended offers");
  return envelope(offers.map(serialiseOffer), { count: offers.length });
}
