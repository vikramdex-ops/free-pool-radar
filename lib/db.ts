/**
 * Read access to the intelligence store.
 *
 * The site is a viewer, not the engine (§85). Every number on screen comes from
 * here, which is why a data change reaches the site without a deployment (§76).
 *
 * Reads use the publishable key. Writes happen only inside the sweep Edge
 * Function with the secret key, and the stored procedures are revoked from
 * `anon`, so a leaked publishable key cannot mutate anything.
 */

import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------ */
/* row shapes                                                          */
/* ------------------------------------------------------------------ */

export type OfferStatus =
  | "upcoming" | "live" | "changed" | "ending" | "exhausted"
  | "ended" | "suspended" | "unverified";

export type OfferType =
  | "shared_pool" | "free_tier" | "rotating_free_model" | "sponsored_inference"
  | "promotional_event" | "free_credits" | "keyless" | "free_trial" | "ended";

export type VerificationLevel =
  | "live_api" | "official_docs" | "official_event_page"
  | "official_announcement" | "official_social" | "secondary" | "community";

export type ChangeType =
  | "new" | "model_added" | "model_removed"
  | "quota_increased" | "quota_decreased"
  | "pool_started" | "pool_exhausted" | "pool_extended" | "pool_cancelled"
  | "price_changed" | "card_required" | "card_removed"
  | "subscription_required" | "subscription_removed"
  | "free_tier_started" | "free_tier_ended"
  | "rate_limit_changed" | "status_changed";

export type SourceHealth =
  | "live" | "slow" | "degraded" | "failed" | "stale" | "disabled";

/** Verification recency bands from §14. */
export type Freshness = "fresh" | "aging" | "stale" | "very_stale" | "unverified";

export interface Provider {
  id: number;
  name: string;
  slug: string;
  official_url: string;
  logo_url: string | null;
  description: string | null;
  provider_type: string | null;
  country: string | null;
  status: "active" | "suspended" | "acquired" | "shut_down";
  free_model_count: number;
  live_offer_count: number;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
}

export interface Model {
  id: number;
  provider_id: number | null;
  model_id: string;
  slug: string;
  display_name: string;
  family: string | null;
  parameter_count: number | null;
  context_window: number | null;
  capabilities: string[];
  official_model_url: string | null;
  first_seen_at: string;
  updated_at: string;
}

export interface Offer {
  id: number;
  provider_id: number;
  model_id: number | null;
  model_id_text: string | null;
  model_label: string;
  offer_type: OfferType;
  status: OfferStatus;
  access_requires_account: boolean;
  access_requires_subscription: boolean;
  payment_required: boolean;
  card_required: boolean;
  api_key_required: boolean;
  keyless: boolean;
  compatibility_openai: boolean;
  compatibility_anthropic: boolean;
  compatibility_other: string | null;
  rpm: number | null;
  rpd: number | null;
  tpm: number | null;
  tpd: number | null;
  monthly_limit: number | null;
  monthly_unit: string | null;
  token_limit: number | null;
  token_limit_unit: string | null;
  pool_size: number | null;
  pool_remaining: number | null;
  pool_unit: string | null;
  credit_amount: number | null;
  credit_currency: string | null;
  start_at: string | null;
  end_at: string | null;
  exhaustion_condition: string | null;
  commercial_use: string | null;
  data_policy: string | null;
  retention_policy: string | null;
  official_evidence_url: string | null;
  secondary_evidence_url: string | null;
  verification_level: VerificationLevel;
  confidence: number | null;
  first_discovered_at: string;
  first_verified_at: string | null;
  last_verified_at: string | null;
  last_seen_live_at: string | null;
  ended_at: string | null;
  is_seed_data: boolean;
}

export interface RadarEvent {
  id: number;
  provider_id: number;
  name: string;
  slug: string;
  description: string | null;
  status: "upcoming" | "live" | "ended" | "cancelled" | "exhausted" | "suspended";
  start_at: string | null;
  end_at: string | null;
  pool_size: number | null;
  pool_remaining: number | null;
  unit: string;
  models: string[];
  eligibility: string | null;
  requirements: string | null;
  exhaustion_condition: string | null;
  official_url: string | null;
  announced_at: string | null;
  discovered_at: string;
  last_verified_at: string | null;
  provider: { id: number; name: string; slug: string; official_url: string } | null;
}

export interface Change {
  id: number;
  provider_id: number | null;
  offer_id: number | null;
  event_id: number | null;
  change_type: ChangeType;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  detected_at: string;
  effective_at: string | null;
  source_url: string | null;
  evidence: string | null;
  severity: "info" | "warning" | "critical";
}

export interface ChangeWithProvider extends Change {
  provider: { id: number; name: string; slug: string } | null;
  /**
   * The offer the change is about, so a feed can name the subject.
   *
   * Without this a row reads "offer: not stated → rotating_free_model" against
   * a shared source URL, and several genuinely different discoveries look
   * identical to a reader.
   */
  offer: {
    id: number;
    model_label: string;
    model_id_text: string | null;
  } | null;
}

/** One recorded observation. Raw payloads are withheld from public reads. */
export interface Observation {
  id: number;
  provider_id: number | null;
  offer_id: number | null;
  event_id: number | null;
  observed_at: string;
  status: OfferStatus | null;
  token_limit: number | null;
  pool_size: number | null;
  pool_remaining: number | null;
  rpm: number | null;
  rpd: number | null;
  tpm: number | null;
  tpd: number | null;
  model_count: number | null;
  source_url: string | null;
  source_type: string | null;
  response_hash: string | null;
  verification_level: VerificationLevel | null;
}

export interface Source {
  id: number;
  provider_slug: string;
  url: string;
  source_type: string;
  priority: number;
  parser_key: string;
  enabled: boolean;
  is_official: boolean;
  interval_hours: number;
  last_fetched_at: string | null;
  last_ok_at: string | null;
  last_status_code: number | null;
  last_latency_ms: number | null;
  last_error: string | null;
  health: SourceHealth;
}

export interface RadarStatus {
  sources_total: number;
  sources_ok: number;
  sources_unhealthy: number;
  offers_live: number;
  offers_upcoming: number;
  offers_ended: number;
  models_total: number;
  providers_total: number;
  candidates_pending: number;
  last_sweep_at: string | null;
  next_sweep_at: string | null;
  last_finished_at: string | null;
  last_duration_ms: number | null;
  computed_at: string;
}

/** An offer joined to its provider, which is how nearly every surface wants it. */
export type OfferWithProvider = Offer & { provider: Provider | null };

/* ------------------------------------------------------------------ */
/* client                                                              */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

/**
 * The slice of the PostgREST builder this module uses. Declared rather than
 * imported so the query shape stays explicit and a missing `.limit` on an
 * unbounded select is visible at the call site.
 */
interface Query extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  select(columns: string): Query;
  eq(column: string, value: string | number | boolean): Query;
  in(column: string, values: readonly (string | number)[]): Query;
  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): Query;
  limit(n: number): Query;
  maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

let cached: { from: (t: string) => Query } | null = null;

/**
 * Returns the read client, or null when the project is not configured.
 *
 * A missing key is a normal state during local setup, so callers get null and
 * render an explicit configuration state rather than a crash or, worse, a page
 * full of invented numbers.
 */
export function db(): { from: (t: string) => Query } | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cached = client as unknown as { from: (t: string) => Query };
  return cached;
}

export const isConfigured = () => db() !== null;

/**
 * Runs a query and returns rows, or an empty array when the project is not
 * configured or the read failed.
 *
 * Callers treat an empty array as "nothing to show" and render the §65 empty
 * state. That is the correct behaviour: never fabricate data to fill a gap.
 * A read error is logged so the cause is never silent.
 */
async function read<T>(table: string, build: (q: Query) => Query): Promise<T[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await build(c.from(table));
  if (error) {
    console.error(`[radar] read ${table} failed: ${error.message}`);
    return [];
  }
  if (!data) return [];
  return (Array.isArray(data) ? data : [data]) as T[];
}

async function readOne<T>(table: string, build: (q: Query) => Query): Promise<T | null> {
  const rows = await read<T>(table, (q) => build(q).limit(1));
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* queries                                                             */
/* ------------------------------------------------------------------ */

export const OFFER_WITH_PROVIDER =
  "*, provider:providers!offers_provider_id_fkey(id,name,slug,official_url," +
  "provider_type,country,status,free_model_count,live_offer_count," +
  "last_verified_at,logo_url,description)";

/** The single-row status view: source health and sweep schedule (§19). */
export const getStatus = () =>
  readOne<RadarStatus>("radar_status", (q) => q.select("*"));

export const getProviders = () =>
  read<Provider>("providers", (q) => q.select("*").order("name"));

export const getProvider = (slug: string) =>
  readOne<Provider>("providers", (q) => q.select("*").eq("slug", slug));

export const getLiveOffers = (limit = 500) =>
  read<OfferWithProvider>("offers", (q) =>
    q
      .select(OFFER_WITH_PROVIDER)
      .in("status", ["live", "changed", "ending"])
      .order("last_verified_at", { ascending: false, nullsFirst: false })
      .limit(limit),
  );

export const getUpcomingOffers = () =>
  read<OfferWithProvider>("offers", (q) =>
    q
      .select(OFFER_WITH_PROVIDER)
      .eq("status", "upcoming")
      .order("start_at", { ascending: true, nullsFirst: true }),
  );

export const getEndedOffers = (limit = 200) =>
  read<OfferWithProvider>("offers", (q) =>
    q
      .select(OFFER_WITH_PROVIDER)
      .eq("status", "ended")
      .order("ended_at", { ascending: false, nullsFirst: false })
      .limit(limit),
  );

export const EVENT_WITH_PROVIDER =
  "*, provider:providers!events_provider_id_fkey(id,name,slug,official_url)";

export const getEvents = () =>
  read<RadarEvent>("events", (q) =>
    q
      .select(EVENT_WITH_PROVIDER)
      .order("start_at", { ascending: true, nullsFirst: true }),
  );

export const getEvent = (slug: string) =>
  readOne<RadarEvent>("events", (q) =>
    q.select(EVENT_WITH_PROVIDER).eq("slug", slug),
  );

/**
 * The change feed selects the offer as well as the provider, because a change
 * is only meaningful once its subject is named.
 */
export const CHANGE_WITH_SUBJECT =
  "*, provider:providers(id,name,slug), " +
  "offer:offers!changes_offer_id_fkey(id, model_label, model_id_text)";

export const getChanges = (limit = 60) =>
  read<ChangeWithProvider>("changes", (q) =>
    q
      .select(CHANGE_WITH_SUBJECT)
      .order("detected_at", { ascending: false })
      .limit(limit),
  );

export const getTimeline = (limit = 300) =>
  read<ChangeWithProvider>("changes", (q) =>
    q
      .select(CHANGE_WITH_SUBJECT)
      .order("detected_at", { ascending: false })
      .limit(limit),
  );

export const getModels = (limit = 600) =>
  read<Model>("models", (q) =>
    q.select("*").order("display_name").limit(limit),
  );

export const getModel = (slug: string) =>
  readOne<Model>("models", (q) => q.select("*").eq("slug", slug));

/**
 * Free routes for one model id, across every provider that serves it.
 *
 * A model is a provider-local id, so the same string can exist at several
 * providers with different terms. That difference is the whole point of the
 * model detail page, so it is matched on the raw id rather than a models row.
 */
export const getOffersForModelId = (modelIdText: string) =>
  read<OfferWithProvider>("offers", (q) =>
    q
      .select(OFFER_WITH_PROVIDER)
      .eq("model_id_text", modelIdText)
      .order("status"),
  );

export const getOffersForProvider = (slug: string) =>
  read<OfferWithProvider>("offers", (q) =>
    q.select(OFFER_WITH_PROVIDER).eq("provider.slug", slug).order("status"),
  );

/** A single offer with its provider, for the evidence page. */
export const getOffer = (id: number) =>
  readOne<OfferWithProvider>("offers", (q) => q.select(OFFER_WITH_PROVIDER).eq("id", id));

/**
 * The recorded observations for one offer.
 *
 * Observations are not publicly readable under RLS, so this returns nothing for
 * an anonymous reader and the evidence page omits the section rather than
 * showing an empty one.
 */
export const getObservationsForOffer = (offerId: number) =>
  read<Observation>("observations", (q) =>
    q
      .select("*")
      .eq("offer_id", offerId)
      .order("observed_at", { ascending: false })
      .limit(10),
  );

/** Every change recorded against one offer. */
export const getChangesForOffer = (offerId: number) =>
  read<ChangeWithProvider>("changes", (q) =>
    q
      .select(CHANGE_WITH_SUBJECT)
      .eq("offer_id", offerId)
      .order("detected_at", { ascending: false })
      .limit(50),
  );

/** Source health is internal (§51), so it is only read on the admin route. */
export const getSources = () =>
  read<Source>("sources", (q) => q.select("*").order("provider_slug"));
