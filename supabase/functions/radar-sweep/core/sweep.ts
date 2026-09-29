/**
 * The sweep (§11, §12).
 *
 *   collectors → normaliser → verifier → change detector → database
 *
 * Runs on a schedule entirely independent of the frontend, so the site never
 * needs a redeployment to receive new data (§76). Invoked by the Supabase Edge
 * Function on a pg_cron tick, and by the protected /api/sweep route for
 * on-demand runs.
 *
 * Three invariants this file exists to hold:
 *
 *  1. A source failure never marks an offer ENDED (§13, acceptance test 5).
 *     A failed fetch updates source health and stops. The previous observation
 *     remains the last known truth and freshness degrades on its own.
 *
 *  2. Running twice with identical data produces no duplicate history (§78,
 *     acceptance test 6). Every offer carries a hash of its normalised payload
 *     and every change carries a dedupe key.
 *
 *  3. One database round trip per collector, not one per offer. Reconciliation
 *     is set-based, so it belongs in a single statement: doing it per offer cost
 *     several hundred sequential HTTP calls per sweep and exhausted the Edge
 *     Function's compute budget.
 */

import { createHash } from "node:crypto";
import {
  COLLECTORS,
  type Collector,
  type CollectorResult,
  type VerificationLevel,
} from "./collectors.ts";

export interface Db {
  /**
   * Calls a parameterised stored procedure by name. The sweep never builds
   * SQL: every collected value travels as a bound parameter, so hostile
   * response content cannot reach a statement.
   */
  query: <T = unknown>(fn: string, p: unknown[]) => Promise<T[]>;
}

export interface SourceHealthUpdate {
  providerSlug: string;
  parserKey: string;
  url: string;
  status: "ok" | "error";
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
  health: "live" | "slow" | "degraded" | "failed";
}

export interface SweepReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  runId: number;
  sources: SourceHealthUpdate[];
  offers: {
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
  };
  modelsCreated: number;
  /** Recorded by the database, which owns change detection. */
  changesCreated: number;
  offersEnded: number;
  notes: string[];
  errors: string[];
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Stable JSON so a payload that did not change hashes identically. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}

/**
 * Unwraps the first row of an RPC result, failing loudly if there is none.
 *
 * A procedure declared `returns setof bigint` comes back as a bare JSON
 * number rather than an object, so reading `.id` off it silently yields
 * undefined and every caller quietly skips its work. Routing all of this
 * through one helper means a shape mismatch is caught in one place.
 */
function firstRow<T>(rows: T[], fn: string): T {
  if (!rows?.length) {
    throw new Error(`${fn} returned no rows`);
  }
  return rows[0];
}

async function timed<T>(fn: () => Promise<T>) {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

/** snake_case, matching the column names the procedure binds from. */
function toRow(
  offer: CollectorResult["offers"][number],
  sourceUrl: string,
  sourceType: string,
): Record<string, unknown> {
  return {
    model_id: offer.modelId,
    model_label: offer.modelLabel,
    offer_type: offer.offerType,
    status: offer.status,
    access_requires_account: offer.accessRequiresAccount,
    access_requires_subscription: offer.accessRequiresSubscription,
    payment_required: offer.paymentRequired,
    card_required: offer.cardRequired,
    api_key_required: offer.apiKeyRequired,
    keyless: offer.keyless,
    compatibility_openai: offer.compatibilityOpenai,
    compatibility_anthropic: offer.compatibilityAnthropic,
    compatibility_other: offer.compatibilityOther,
    rpm: offer.rpm,
    rpd: offer.rpd,
    tpm: offer.tpm,
    tpd: offer.tpd,
    monthly_limit: offer.monthlyLimit,
    monthly_unit: offer.monthlyUnit,
    token_limit: offer.tokenLimit,
    token_limit_unit: offer.tokenLimitUnit,
    pool_size: offer.poolSize,
    pool_remaining: offer.poolRemaining,
    pool_unit: offer.poolUnit,
    credit_amount: offer.creditAmount,
    credit_currency: offer.creditCurrency,
    start_at: offer.startAt,
    end_at: offer.endAt,
    verification_level: offer.verificationLevel,
    official_evidence_url: offer.officialEvidenceUrl,
    evidence: offer.evidence,
    source_url: sourceUrl,
    source_type: sourceType,
    payload_hash: sha256(stableStringify(offer)),
  };
}

const eventSlug = (providerSlug: string, name: string) =>
  `${providerSlug}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

/**
 * Runs one full sweep. A single source failure is recorded and the remaining
 * collectors still run; only an unexpected shape mismatch aborts the sweep,
 * because that would mean writing data nobody can account for.
 */
export async function runSweep(db: Db): Promise<SweepReport> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const sources: SourceHealthUpdate[] = [];
  const notes: string[] = [];
  const errors: string[] = [];
  const counts = { created: 0, updated: 0, unchanged: 0, failed: 0 };
  let modelsCreated = 0;

  const run = await db.query<{ id: number }>("rpc_start_sweep", [
    { trigger: process.env.SWEEP_TRIGGER ?? "cron" },
  ]);
  const runId = firstRow(run, "rpc_start_sweep").id;

  for (const collector of COLLECTORS) {
    const url = collector.urls[0].url;
    const sourceType = collector.urls[0].type;
    let result: CollectorResult;
    let httpStatus: number | null = null;
    let ms = 0;
    let error: string | null = null;

    try {
      const t = await timed(() => collector.collect());
      result = t.value;
      ms = t.ms;
    } catch (e) {
      // Invariant 1 lives here: this path records a failed source and moves on.
      // It must never touch an offer's status.
      error = e instanceof Error ? e.message : String(e);
      counts.failed += 1;
      errors.push(`${collector.key}: ${error}`);
      sources.push({
        providerSlug: collector.providerSlug,
        parserKey: collector.key,
        url,
        status: "error",
        httpStatus: null,
        latencyMs: Date.now() - t0,
        error,
        health: "failed",
      });
      continue;
    }

    sources.push({
      providerSlug: collector.providerSlug,
      parserKey: collector.key,
      url,
      status: "ok",
      httpStatus,
      latencyMs: ms,
      error: null,
      health: ms > 5000 ? "slow" : "live",
    });

    notes.push(...result.notes);

    // One round trip for the whole provider (§11: collect → normalise →
    // verify → detect changes → store). Change detection happens in SQL because
    // only the database holds both the previous and the current value.
    const payload = {
      provider_slug: collector.providerSlug,
      free_model_count: result.freeModelCount,
      offers: result.offers.map((o) => toRow(o, url, sourceType)),
      events: result.events.map((e) => ({
        // The collector owns the slug. Falling back to a name-derived one
        // would let the same pool be stored twice under two identities.
        slug: e.slug || eventSlug(e.providerSlug, e.name),
        name: e.name,
        description: e.description,
        status: e.status,
        start_at: e.startAt,
        end_at: e.endAt,
        pool_size: e.poolSize,
        pool_remaining: e.poolRemaining,
        unit: e.unit,
        models: e.models,
        eligibility: e.eligibility,
        requirements: e.requirements,
        exhaustion_condition: e.exhaustionCondition,
        official_url: e.officialUrl,
      })),
    };

    let recon: {
      offers_created: number;
      offers_updated: number;
      offers_unchanged: number;
      models_created: number;
    }[];
    try {
      recon = await db.query("rpc_reconcile_sweep", [payload]);
    } catch (e) {
      // Name the collector in the failure. A database error inside a
      // set-based reconcile identifies the provider but not the row, and
      // "some provider failed" is not something anyone can act on.
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `reconcile failed for ${collector.key} ` +
          `(${payload.offers.length} offers, ${payload.events.length} events): ${msg}`,
      );
    }

    const r = firstRow(recon, `rpc_reconcile_sweep(${collector.key})`);
    counts.created += r.offers_created ?? 0;
    counts.updated += r.offers_updated ?? 0;
    counts.unchanged += r.offers_unchanged ?? 0;
    modelsCreated += r.models_created ?? 0;
  }

  // Source health. Note this records health only: on the failure path no offer
  // status is touched, so a dead source degrades to FAILED and its offers
  // simply age into staleness (§13).
  for (const s of sources) {
    await db.query("rpc_update_source", [
      {
        provider_slug: s.providerSlug,
        parser_key: s.parserKey,
        http_status: s.httpStatus,
        latency_ms: s.latencyMs,
        error: s.error,
        health: s.health,
        status: s.status,
      },
    ]);
  }

  await db.query("rpc_rollup_live_offers", [{}]);

  // Change detection lives in SQL, so the counts come back from the database.
  const summary = await db.query<{ changes_created: number; offers_ended: number }>(
    "rpc_run_changes",
    [{ id: runId }],
  );
  const { changes_created: changesCreated, offers_ended: offersEnded } =
    firstRow(summary, "rpc_run_changes");

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;
  await db.query("rpc_finish_sweep", [
    {
      id: runId,
      duration_ms: durationMs,
      sources_total: sources.length,
      sources_ok: sources.filter((s) => s.status === "ok").length,
      sources_failed: sources.filter((s) => s.status !== "ok").length,
      offers_new: counts.created,
      offers_changed: counts.updated,
      offers_ended: offersEnded,
      changes_created: changesCreated,
      errors: errors.length ? errors : null,
    },
  ]);

  return {
    startedAt,
    finishedAt,
    durationMs,
    runId,
    sources,
    offers: counts,
    modelsCreated,
    changesCreated,
    offersEnded,
    notes,
    errors,
  };
}

export type { Collector, CollectorResult, VerificationLevel };
