/**
 * Formatting rules (§56, §73, §74, §9, §14).
 *
 * The governing rule: a number is shown in the unit the provider published it
 * in, and a number the provider does not publish is shown as absent. Nothing
 * here ever substitutes a guess for a missing value.
 */

import type { Freshness, Offer, OfferStatus, OfferType, VerificationLevel } from "./db";

/* ------------------------------------------------------------------ */
/* units                                                               */
/* ------------------------------------------------------------------ */

/** Human labels for the units a provider might publish. */
const UNIT_LABEL: Record<string, string> = {
  tokens: "tokens",
  weighted_tokens: "weighted tokens",
  requests: "requests",
  credits: "credits",
  dollars: "USD",
  neurons: "neurons",
  images: "images",
  characters: "characters",
  gpus: "GPU-seconds",
};

export const unitLabel = (unit: string | null | undefined): string =>
  (unit && UNIT_LABEL[unit]) || unit || "units";

/** A count with thin separators: 5000000000 → 5,000,000,000. */
export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

/**
 * Compact form for headline figures: 10,000,000,000 → 10B.
 *
 * Used where the exact figure is available on the same screen, never as the
 * only place a number appears.
 */
export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${trim(n / 1e12)}T`;
  if (abs >= 1e9) return `${trim(n / 1e9)}B`;
  if (abs >= 1e6) return `${trim(n / 1e6)}M`;
  if (abs >= 1e3) return `${trim(n / 1e3)}K`;
  return String(n);
}

const trim = (v: number) => {
  const s = v.toFixed(v < 10 ? 2 : 1);
  return s.replace(/\.?0+$/, "");
};

/** The phrase used wherever a provider has not published a figure (§9). */
export const NOT_STATED = "Not publicly stated";

/**
 * Renders a quota in the provider's own unit, e.g. "60 rpm", "4,000,000 tokens".
 * Returns null when nothing is known, so the caller can show NOT_STATED rather
 * than an empty cell that reads as zero.
 */
export function quota(offer: Offer): string | null {
  const parts: string[] = [];
  if (offer.rpm !== null) parts.push(`${num(offer.rpm)} rpm`);
  if (offer.rpd !== null) parts.push(`${num(offer.rpd)} req/day`);
  if (offer.tpm !== null) parts.push(`${num(offer.tpm)} tok/min`);
  if (offer.tpd !== null) parts.push(`${num(offer.tpd)} tok/day`);
  if (offer.token_limit !== null) {
    parts.push(`${num(offer.token_limit)} ${unitLabel(offer.token_limit_unit)}`);
  }
  if (offer.monthly_limit !== null) {
    parts.push(
      `${num(offer.monthly_limit)} ${unitLabel(offer.monthly_unit)}/mo`,
    );
  }
  if (offer.credit_amount !== null) {
    parts.push(`${offer.credit_amount} ${offer.credit_currency ?? "credit"}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Pool size and remaining, in the published unit. */
export function pool(offer: Offer): { size: string; remaining: string; pct: number } | null {
  if (offer.pool_size === null && offer.pool_remaining === null) return null;
  const u = unitLabel(offer.pool_unit);
  return {
    size: offer.pool_size === null ? "—" : `${num(offer.pool_size)} ${u}`,
    remaining:
      offer.pool_remaining === null ? "—" : `${num(offer.pool_remaining)} ${u}`,
    pct:
      offer.pool_size && offer.pool_remaining !== null
        ? Math.max(0, Math.min(100, (offer.pool_remaining / offer.pool_size) * 100))
        : 0,
  };
}

/* ------------------------------------------------------------------ */
/* time                                                                */
/* ------------------------------------------------------------------ */

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

/** Editorial UTC date: "28 SEP 2026" (§74). */
export function dateUTC(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Editorial UTC time: "17:30 UTC" (§74). */
export function timeUTC(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

/** Combined: "28 SEP 2026 · 17:30 UTC". */
export function stampUTC(iso: string | null | undefined): string | null {
  const d = dateUTC(iso);
  const t = timeUTC(iso);
  if (!d) return null;
  return t ? `${d} · ${t}` : d;
}

/** ISO 8601 for API responses (§74). */
export const iso = (v: string | null | undefined): string | null => v ?? null;

/**
 * Relative age, used for "Verified 23 minutes ago" (§14).
 *
 * Computed from an explicit `now` so a server render and a client render agree
 * and React does not report a hydration mismatch.
 */
export function ago(isoStr: string | null | undefined, now: number): string | null {
  if (!isoStr) return null;
  const t = new Date(isoStr).getTime();
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

/** Freshness bands from §14. Computed here so every surface agrees. */
export function freshness(lastVerified: string | null | undefined, now: number): Freshness {
  if (!lastVerified) return "unverified";
  const h = (now - new Date(lastVerified).getTime()) / 3_600_000;
  if (h < 6) return "fresh";
  if (h < 24) return "aging";
  if (h < 72) return "stale";
  return "very_stale";
}

/**
 * Countdown split into parts for the upcoming cards.
 *
 * A start date in the past yields a zeroed countdown rather than a negative
 * one, so a pool that is already open never displays "−3d".
 */
export function countdown(startIso: string | null | undefined, now: number) {
  if (!startIso) return null;
  const t = new Date(startIso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = Math.max(0, t - now);
  const totalMinutes = Math.floor(ms / 60_000);
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    started: ms === 0,
  };
}

/* ------------------------------------------------------------------ */
/* vocabulary                                                          */
/* ------------------------------------------------------------------ */

/** Access type labels (§4). Never collapsed into a single "free" badge (§5). */
export const OFFER_TYPE_LABEL: Record<OfferType, string> = {
  shared_pool: "Shared pool",
  free_tier: "Free tier",
  rotating_free_model: "Rotating free model",
  sponsored_inference: "Sponsored",
  promotional_event: "Promotional event",
  free_credits: "Free credits",
  keyless: "Keyless",
  free_trial: "Free trial",
  ended: "Ended",
};

export const STATUS_LABEL: Record<OfferStatus, string> = {
  upcoming: "UPCOMING",
  live: "LIVE",
  changed: "CHANGED",
  ending: "ENDING",
  exhausted: "EXHAUSTED",
  ended: "ENDED",
  suspended: "SUSPENDED",
  unverified: "UNVERIFIED",
};

export const VERIFICATION_LABEL: Record<VerificationLevel, string> = {
  live_api: "Live API",
  official_docs: "Official docs",
  official_event_page: "Official event page",
  official_announcement: "Official announcement",
  official_social: "Official social",
  secondary: "Secondary source",
  community: "Community discovery",
};

/** Evidence rank from the §8 hierarchy. 1 is strongest. */
export const VERIFICATION_RANK: Record<VerificationLevel, number> = {
  live_api: 1,
  official_docs: 2,
  official_event_page: 3,
  official_announcement: 4,
  official_social: 5,
  secondary: 6,
  community: 7,
};

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  fresh: "FRESH",
  aging: "AGING",
  stale: "STALE",
  very_stale: "VERY STALE",
  unverified: "UNVERIFIED",
};

/**
 * Human phrasing for a change, e.g. "CARD REQUIREMENT CHANGED".
 *
 * The type drives the headline; the field and values carry the detail. Both are
 * always shown, so a reader never has to infer the direction of a change.
 */
export const CHANGE_LABEL: Record<string, string> = {
  new: "NEW",
  model_added: "MODEL ADDED",
  model_removed: "MODEL REMOVED",
  quota_increased: "QUOTA INCREASED",
  quota_decreased: "QUOTA DECREASED",
  pool_started: "POOL OPENED",
  pool_exhausted: "POOL EXHAUSTED",
  pool_extended: "POOL EXTENDED",
  pool_cancelled: "POOL CANCELLED",
  price_changed: "PRICE CHANGED",
  card_required: "CARD NOW REQUIRED",
  card_removed: "CARD NO LONGER REQUIRED",
  subscription_required: "SUBSCRIPTION NOW REQUIRED",
  subscription_removed: "SUBSCRIPTION NO LONGER REQUIRED",
  free_tier_started: "FREE TIER STARTED",
  free_tier_ended: "FREE TIER ENDED",
  rate_limit_changed: "RATE LIMIT CHANGED",
  status_changed: "STATUS CHANGED",
};

/** Field names as they read in a sentence rather than as a column. */
export const FIELD_LABEL: Record<string, string> = {
  status: "status",
  rpm: "requests per minute",
  rpd: "requests per day",
  tpm: "tokens per minute",
  tpd: "tokens per day",
  card_required: "credit card requirement",
  payment_required: "payment requirement",
  access_requires_subscription: "subscription requirement",
  pool_remaining: "pool remaining",
  pool_size: "pool size",
  token_limit: "token limit",
  event_status: "event status",
  offer: "offer",
};

/** The §56 rule in one place: a missing figure is absent, never zero. */
export const orNotStated = (v: string | null | undefined): string =>
  v && v.trim() ? v : NOT_STATED;
